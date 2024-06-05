/**
 * @file
 * This file is part of AdGuard Browser Extension (https://github.com/AdguardTeam/AdguardBrowserExtension).
 *
 * AdGuard Browser Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * AdGuard Browser Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdGuard Browser Extension. If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Update filters in repository
 */
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

import fse from 'fs-extra';
import axios from 'axios';

import { type RegularFilterMetadata } from '../../Extension/src/background/schema';
import { cliLog } from '../cli-log';
import {
    METADATA_DOWNLOAD_URL_FORMAT,
    FILTERS_DEST,
    METADATA_I18N_DOWNLOAD_URL_FORMAT,
    FILTER_DOWNLOAD_URL_FORMAT,
    OPTIMIZED_FILTER_DOWNLOAD_URL_FORMAT,
} from '../constants';
import {
    ADGUARD_FILTERS_IDS,
    LOCAL_METADATA_FILE_NAME,
    LOCAL_I18N_METADATA_FILE_NAME,
} from '../../constants';

const CHECKSUM_PATTERN = /^\s*!\s*checksum[\s-:]+([\w\+/=]+).*[\r\n]+/i;

/**
 * List of browsers which has its own filters assets directory.
 */
export const enum AssetsFiltersBrowser {
    Chromium = 'chromium',
    ChromiumMv3 = 'chromium-mv3',
    Edge = 'edge',
    Firefox = 'firefox',
    Opera = 'opera',
}

/**
 * Data for downloading a resource.
 */
type DownloadResourceData = {
    /**
     * URL to download the resource.
     */
    url: string;

    /**
     * File name to save the resource.
     */
    file: string;

    /**
     * Whether to validate the checksum of the downloaded resource.
     */
    validate?: boolean;
};

const getFiltersMetadataDownloadData = (browser: AssetsFiltersBrowser): DownloadResourceData => {
    return {
        url: METADATA_DOWNLOAD_URL_FORMAT.replace('%browser', browser),
        file: LOCAL_METADATA_FILE_NAME,
    };
};

const getFiltersI18nMetadataDownloadData = (browser: AssetsFiltersBrowser): DownloadResourceData => {
    return {
        url: METADATA_I18N_DOWNLOAD_URL_FORMAT.replace('%browser', browser),
        file: LOCAL_I18N_METADATA_FILE_NAME,
    };
};

/**
 * Returns an array needed for downloading filters resources:
 * - filters metadata
 * - i18n metadata
 * - filters and their optimized versions — only {@link ADGUARD_FILTERS_IDS}
 *
 * @param browser Which browser filters to download
 *
 * @returns Array of resources download data.
 */
const getUrlsOfFiltersResources = (browser: AssetsFiltersBrowser): DownloadResourceData[] => {
    const filters = [];
    const filtersMobile = [];
    const meta = [];

    meta.push(getFiltersMetadataDownloadData(browser));

    meta.push(getFiltersI18nMetadataDownloadData(browser));

    // eslint-disable-next-line no-restricted-syntax
    for (const filterId of ADGUARD_FILTERS_IDS) {
        filters.push({
            url: FILTER_DOWNLOAD_URL_FORMAT.replace('%browser', browser).replace('%filter', String(filterId)),
            file: `filter_${filterId}.txt`,
            validate: true,
        });

        filtersMobile.push({
            url: OPTIMIZED_FILTER_DOWNLOAD_URL_FORMAT.replace('%browser', browser).replace('%s', String(filterId)),
            file: `filter_mobile_${filterId}.txt`,
            validate: true,
        });
    }

    return [
        ...meta,
        ...filters,
        ...filtersMobile,
    ];
};

/**
 * Normalizes a response.
 *
 * @param response Filter rules response.
 * @returns Normalized response.
 */
const normalizeResponse = (response: string): string => {
    const partOfResponse = response.substring(0, 200);
    const match = partOfResponse.match(CHECKSUM_PATTERN);
    if (match) {
        response = response.replace(match[0], '');
    }
    response = response.replace(/\r/g, '');
    response = response.replace(/\n+/g, '\n');
    return response;
};

export const calculateChecksum = (body: string): string => {
    return crypto.createHash('md5').update(normalizeResponse(body)).digest('base64').replace(/=/g, '');
};

/**
 * Validates filter rules checksum.
 * See https://adblockplus.org/en/filters#special-comments for details.
 *
 * Logs an error if checksum is invalid.
 *
 * @param resourceData Resource data.
 * @param body Filter rules response.
 */
const validateChecksum = (resourceData: DownloadResourceData, body: string): void => {
    const partOfResponse = body.substring(0, 200);
    const checksumMatch = partOfResponse.match(CHECKSUM_PATTERN);

    if (!checksumMatch || !checksumMatch[1]) {
        cliLog.error(`Filter rules from ${resourceData.url} does not contain a checksum ${partOfResponse}`);
        return;
    }

    const bodyChecksum = calculateChecksum(body);

    if (bodyChecksum !== checksumMatch[1]) {
        cliLog.error(`Wrong checksum: found ${bodyChecksum}, expected ${checksumMatch[1]}`);
    }

    cliLog.info('Checksum is valid');
};

/**
 * Downloads a filter resource, saves it to the filters directory, and returns its content.
 *
 * @param resourceData Data for downloading a resource.
 * @param browser Browser assets filters directory name.
 *
 * @returns Response content as a string.
 */
const downloadFilter = async (resourceData: DownloadResourceData, browser: AssetsFiltersBrowser): Promise<string> => {
    const { url, file, validate } = resourceData;

    const filtersDir = FILTERS_DEST.replace('%browser', browser);

    fse.ensureDirSync(filtersDir);

    cliLog.info(`Downloading ${url}...`);

    const response = await axios.get(url, { responseType: 'arraybuffer' });

    if (validate) {
        validateChecksum(resourceData, response.data.toString());
    }

    await fs.promises.writeFile(path.join(filtersDir, file), response.data);

    cliLog.info('Done');

    return response.data.toString();
};

/**
 * Returns all filter ids from the metadata file.
 *
 * @param metadataContent Metadata file content.
 *
 * @returns Array of filter ids as strings.
 */
const getAllFiltersIds = (metadataContent: string): string[] => {
    let filters: RegularFilterMetadata[] = [];
    try {
        filters = JSON.parse(metadataContent).filters;
    } catch (e) {
        cliLog.error('Failed to parse filters metadata');
    }

    return filters.map((filter) => String(filter.filterId));
};

/**
 * Prepares filters for chromium-mv3:
 * 1. Downloads chromium filters metadata and parses it to get all filter ids.
 * 2. Downloads chromium i18n metadata.
 * 3. Downloads all chromium filters and stores them in the chromium-mv3 folder.
 */
const downloadAndPrepareMv3Filters = async () => {
    const chromiumFiltersMetadata = await downloadFilter(
        // chromium mv3 filters metadata is the same as chromium filters metadata
        getFiltersMetadataDownloadData(AssetsFiltersBrowser.Chromium),
        AssetsFiltersBrowser.ChromiumMv3,
    );

    // download chromium i18n metadata file
    await downloadFilter(
        getFiltersI18nMetadataDownloadData(AssetsFiltersBrowser.Chromium),
        AssetsFiltersBrowser.ChromiumMv3,
    );

    const chromiumFiltersIds = getAllFiltersIds(chromiumFiltersMetadata);

    // eslint-disable-next-line no-restricted-syntax
    for (let i = 0; i < chromiumFiltersIds.length; i += 1) {
        const filterId = chromiumFiltersIds[i];
        if (!filterId) {
            continue;
        }

        const downloadData = {
            // download chromium versions of filters
            url: FILTER_DOWNLOAD_URL_FORMAT
                .replace('%browser', AssetsFiltersBrowser.Chromium)
                .replace('%filter', filterId),
            file: `filter_${filterId}.txt`,
            validate: true,
        };
        // and store them in the chromium-mv3 folder
        await downloadFilter(downloadData, AssetsFiltersBrowser.ChromiumMv3); // eslint-disable-line no-await-in-loop
    }
};

/**
 * Downloads filters for the specified browser
 *
 * @param browser Browser assets filters directory name
 */
const startDownload = async (browser: AssetsFiltersBrowser): Promise<void> => {
    const urls = getUrlsOfFiltersResources(browser);
    for (let i = 0; i < urls.length; i += 1) {
        const url = urls[i];
        if (!url) {
            continue;
        }
        // eslint-disable-next-line no-await-in-loop
        await downloadFilter(url, browser);
    }
};

export const downloadFilters = async () => {
    await startDownload(AssetsFiltersBrowser.Chromium);
    await startDownload(AssetsFiltersBrowser.Edge);
    await startDownload(AssetsFiltersBrowser.Firefox);
    await startDownload(AssetsFiltersBrowser.Opera);
    await downloadAndPrepareMv3Filters();
};