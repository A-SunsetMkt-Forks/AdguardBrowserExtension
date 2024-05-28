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

import React from 'react';

import { ForwardFrom } from '../../../../../common/forward';
import { translator } from '../../../../../common/translators/translator';
import { messenger } from '../../../../services/messenger';
import { Icon } from '../../../../common/components/ui/Icon';

import { type SingleActionParams } from './types';

import '../actions.pcss';

export const CheckSiteSecurityAction = ({ className, applicationAvailable, url }: SingleActionParams) => {
    /**
     * Handle site security check action click.
     */
    const handleCheckSiteSecurity = () => {
        if (!applicationAvailable) {
            return;
        }
        messenger.checkSiteSecurity(url, ForwardFrom.Popup);
        window.close();
    };

    return (
        <button
            type="button"
            className={className}
            onClick={handleCheckSiteSecurity}
        >
            <Icon
                id="#info"
                classname="icon--action icon--action--info"
            />
            <div className="action__title">
                {translator.getMessage('popup_security_report')}
            </div>
        </button>
    );
};