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

import React, { useContext, useState } from 'react';
import { observer } from 'mobx-react';

import { handleWithMinLoaderDelay } from '../../../common/components/helpers';
import { Loader } from '../../../common/components/Loader';
import { rootStore } from '../../stores/RootStore';
import { Setting, SETTINGS_TYPES } from '../Settings/Setting';

export const AllowlistSwitcher = observer(() => {
    const { settingsStore } = useContext(rootStore);

    const { settings } = settingsStore;

    const { AllowlistEnabled } = settings.names;

    const [showLoader, setShowLoader] = useState(false);

    const allowlistChangeHandler = ({ id, data }) => {
        handleWithMinLoaderDelay(
            setShowLoader,
            () => settingsStore.updateSetting(id, data),
        );
    };

    return (
        <>
            <Loader condition={showLoader} />
            <Setting
                id={AllowlistEnabled}
                type={SETTINGS_TYPES.CHECKBOX}
                value={settings.values[AllowlistEnabled]}
                handler={allowlistChangeHandler}
            />
        </>
    );
});