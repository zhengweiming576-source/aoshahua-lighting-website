// Aoshahua Lighting — legal pages content.
// Serves third-party developer platform review (LinkedIn Developers, Meta Developers, ...).
// Rendered by App.jsx at /privacy-policy, /terms-of-service and /data-deletion.

import { CONTACT } from './data';

export const LEGAL_ENTITY = 'Jiangmen AOSHAHUA Lighting Co., Ltd.';
export const BRAND_NAME = 'AOSHAHUA Lighting';
export const APP_NAME = 'AOSHAHUA AI Marketing Center';
export const SITE_URL = 'https://aoshahualighting.site.accio.ai/';
// Single source of truth: the contact address shown site-wide comes from
// content.json → CONTACT.email, so it can be changed in the local content
// editor and every legal page, the footer and the inquiry cart follow.
export const CONTACT_EMAIL = CONTACT.email;
export const EFFECTIVE_DATE = 'September 10, 2026';

export const LEGAL_LINKS = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms of Service', href: '/terms-of-service' },
  { label: 'Data Deletion Instructions', href: '/data-deletion' },
];

const email = { type: 'contact-line', label: 'Email', value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` };
const website = { type: 'contact-line', label: 'Website', value: SITE_URL, href: SITE_URL };

export const LEGAL_PAGES = {
  '/privacy-policy': {
    path: '/privacy-policy',
    title: 'Privacy Policy',
    effectiveDate: EFFECTIVE_DATE,
    intro: [
      `${LEGAL_ENTITY} (\u201c${BRAND_NAME}\u201d, \u201cwe\u201d, \u201cour\u201d, or \u201cus\u201d) respects your privacy and is committed to protecting information processed through ${APP_NAME}.`,
    ],
    sections: [
      {
        heading: '1. Purpose of the Application',
        blocks: [
          {
            type: 'p',
            text: `${APP_NAME} is an internal social media management tool used by ${BRAND_NAME} to prepare, manage and publish company marketing content to authorized social media accounts, including platforms such as LinkedIn, Facebook, Instagram, TikTok, YouTube and Pinterest.`,
          },
        ],
      },
      {
        heading: '2. Information We May Process',
        blocks: [
          {
            type: 'p',
            text: 'When an authorized user connects a social media account, the application may process information provided by the relevant platform, such as account identifiers, profile information, Page or company account information, authorization tokens and content publishing permissions.',
          },
          {
            type: 'p',
            text: 'We only request information and permissions necessary to provide the requested social media management and publishing functions.',
          },
        ],
      },
      {
        heading: '3. How We Use Information',
        blocks: [
          { type: 'p', text: 'Information is used only to:' },
          {
            type: 'ul',
            items: [
              'authenticate authorized users;',
              'connect authorized social media accounts;',
              'publish or manage content requested by the user;',
              'display publishing status and basic performance information where permitted by the platform;',
              'maintain security and operational records.',
            ],
          },
          { type: 'p', text: 'We do not sell personal information or social media account information to third parties.' },
        ],
      },
      {
        heading: '4. Access Tokens and Account Credentials',
        blocks: [
          {
            type: 'p',
            text: "Where supported by a platform, authentication is performed using the platform's official OAuth authorization process. Users are not required to provide their social media passwords directly to " + APP_NAME + '.',
          },
          {
            type: 'p',
            text: 'Authorization credentials are used only for the permissions granted by the account owner and may be revoked through the relevant social media platform.',
          },
        ],
      },
      {
        heading: '5. Data Sharing',
        blocks: [
          { type: 'p', text: 'We do not sell, rent or commercially disclose personal data to unrelated third parties.' },
          {
            type: 'p',
            text: 'Information may be transmitted to the relevant social media platform only as necessary to perform actions requested by the authorized user.',
          },
        ],
      },
      {
        heading: '6. Data Retention',
        blocks: [
          {
            type: 'p',
            text: 'We retain information only for as long as reasonably necessary to operate the application, maintain publishing records, comply with applicable requirements, or until authorization is revoked or deletion is requested.',
          },
        ],
      },
      {
        heading: '7. Data Deletion',
        blocks: [
          {
            type: 'p',
            text: `Users may request deletion of information associated with ${APP_NAME} by contacting us using the contact information below. Users may also revoke application access through the settings of the relevant social media platform.`,
          },
        ],
      },
      {
        heading: '8. Security',
        blocks: [
          {
            type: 'p',
            text: 'We take reasonable technical and organizational measures to protect account authorization information and other data against unauthorized access, disclosure, alteration or loss.',
          },
        ],
      },
      {
        heading: '9. Third-Party Platforms',
        blocks: [
          {
            type: 'p',
            text: `${APP_NAME} interacts with third-party social media platforms. Use of those platforms is also subject to their respective privacy policies, terms and developer policies.`,
          },
        ],
      },
      {
        heading: '10. Changes to This Policy',
        blocks: [
          {
            type: 'p',
            text: 'We may update this Privacy Policy when our application, platform integrations or legal requirements change. The latest version will be published on this page.',
          },
        ],
      },
      {
        heading: '11. Contact Us',
        blocks: [
          { type: 'p', text: LEGAL_ENTITY },
          { type: 'p', text: BRAND_NAME },
          email,
          website,
        ],
      },
    ],
  },

  '/terms-of-service': {
    path: '/terms-of-service',
    title: 'Terms of Service',
    effectiveDate: EFFECTIVE_DATE,
    intro: [
      `These Terms of Service (\u201cTerms\u201d) govern the use of ${APP_NAME} (the \u201cApplication\u201d), operated by ${LEGAL_ENTITY} (\u201c${BRAND_NAME}\u201d, \u201cwe\u201d, \u201cour\u201d, or \u201cus\u201d). By accessing or using the Application, you agree to these Terms. If you do not agree, do not use the Application.`,
      `The Application is an internal social media content management and publishing tool used by ${BRAND_NAME} to prepare, manage and publish company marketing content to authorized social media accounts, such as LinkedIn, Facebook, Instagram, TikTok, YouTube and Pinterest, and to view basic publishing information made available by those platforms.`,
    ],
    sections: [
      {
        heading: '1. Authorized Use Only',
        blocks: [
          {
            type: 'p',
            text: 'Access to the Application is limited to authorized users who have been granted permission by us. You must not share access credentials, or attempt to access the Application or connected accounts without authorization.',
          },
        ],
      },
      {
        heading: '2. Connecting Social Media Accounts',
        blocks: [
          {
            type: 'p',
            text: 'You may only connect social media accounts that you own, or that you are otherwise duly authorized to manage on behalf of their owner. By connecting an account, you confirm that you have the necessary authority to grant the Application the permissions requested by the relevant platform.',
          },
          {
            type: 'p',
            text: 'You are responsible for ensuring that all connections comply with the terms, developer policies and community guidelines of the applicable social media platform.',
          },
        ],
      },
      {
        heading: '3. Responsibility for Published Content',
        blocks: [
          {
            type: 'p',
            text: 'You are solely responsible for the content you prepare, schedule, publish or manage through the Application, and for ensuring that such content is accurate, lawful and does not infringe the rights of any third party.',
          },
        ],
      },
      {
        heading: '4. Prohibited Conduct',
        blocks: [
          { type: 'p', text: 'You must not use the Application to:' },
          {
            type: 'ul',
            items: [
              'engage in unlawful, fraudulent, deceptive or misleading activity;',
              'send spam, unsolicited bulk messages, or content that violates platform policies;',
              'infringe intellectual property, privacy, publicity or other rights of any third party;',
              'access, connect or publish to any account without proper authorization;',
              'upload malicious code, attempt to disrupt the Application, or circumvent security or access controls.',
            ],
          },
        ],
      },
      {
        heading: '5. Third-Party Platforms and Availability',
        blocks: [
          {
            type: 'p',
            text: 'The Application depends on third-party social media platforms and their APIs. Those platforms may change, restrict, suspend, deprecate or discontinue their services, features, permissions or policies at any time and at their sole discretion. Such changes may affect or interrupt the functionality of the Application.',
          },
          {
            type: 'p',
            text: 'We do not guarantee that any third-party platform will remain available, that any specific integration or permission will continue to be supported, or that the Application will operate without interruption or error. We are not responsible for the acts, omissions, outages or policy decisions of third-party platforms.',
          },
        ],
      },
      {
        heading: '6. Revoking Access',
        blocks: [
          {
            type: 'p',
            text: 'You may revoke the Application\u2019s access to a connected social media account at any time through the account settings of the relevant platform, or by contacting us. Revoking access stops further publishing activity for that account.',
          },
        ],
      },
      {
        heading: '7. Changes and Termination of the Service',
        blocks: [
          {
            type: 'p',
            text: 'We may modify, update, suspend or discontinue the Application, in whole or in part, at any time, including to comply with platform requirements or applicable law. We may also suspend or terminate your access if you breach these Terms or use the Application in a manner that creates risk for us, other users or third-party platforms.',
          },
        ],
      },
      {
        heading: '8. Disclaimer and Limitation of Liability',
        blocks: [
          {
            type: 'p',
            text: 'The Application is provided on an \u201cas is\u201d and \u201cas available\u201d basis, without warranties of any kind, whether express or implied, including any implied warranties of merchantability, fitness for a particular purpose or non-infringement.',
          },
          {
            type: 'p',
            text: 'To the maximum extent permitted by applicable law, ' + LEGAL_ENTITY + ' shall not be liable for any indirect, incidental, special, consequential or punitive damages, or for any loss of profits, revenue, data, goodwill or business opportunity, arising out of or in connection with the use of, or inability to use, the Application.',
          },
        ],
      },
      {
        heading: '9. Changes to These Terms',
        blocks: [
          {
            type: 'p',
            text: 'We may update these Terms from time to time. The current version will be published on this page, together with its effective date. Continued use of the Application after an update constitutes acceptance of the revised Terms.',
          },
        ],
      },
      {
        heading: '10. Contact Us',
        blocks: [
          { type: 'p', text: LEGAL_ENTITY },
          { type: 'p', text: `Application: ${APP_NAME}` },
          email,
          website,
        ],
      },
    ],
  },

  '/data-deletion': {
    path: '/data-deletion',
    title: 'Data Deletion Instructions',
    effectiveDate: EFFECTIVE_DATE,
    intro: [
      `This page explains how users can delete data associated with ${APP_NAME}, operated by ${LEGAL_ENTITY}.`,
      'You may request deletion of data associated with your use of the Application using either of the methods below.',
    ],
    sections: [
      {
        heading: 'Method 1: Revoke the Application\u2019s Access',
        blocks: [
          {
            type: 'p',
            text: 'You can revoke the Application\u2019s authorization in the settings of the relevant social media platform account. Once authorization is revoked, the Application can no longer access that account or act on your behalf.',
          },
          {
            type: 'p',
            text: 'For example, on Meta platforms (Facebook and Instagram), you can remove the Application under Settings \u2192 Apps and Websites (or Business Integrations). Similar options are available in the account settings of other platforms.',
          },
        ],
      },
      {
        heading: 'Method 2: Send a Data Deletion Request by Email',
        blocks: [
          {
            type: 'p',
            text: `You can send a data deletion request to: ${CONTACT_EMAIL}`,
          },
          { type: 'p', text: 'Suggested email subject:' },
          { type: 'code', text: 'Data Deletion Request \u2013 AOSHAHUA AI Marketing Center' },
          {
            type: 'p',
            text: 'In your request, you may provide basic identifying information related to the account concerned \u2014 such as the name of the social media platform, the account name or account identifier, and the email address associated with your use of the Application \u2014 so that we can identify the data to be deleted.',
          },
        ],
      },
      {
        heading: 'How We Handle a Valid Request',
        blocks: [
          {
            type: 'p',
            text: 'After receiving a valid data deletion request, ' + BRAND_NAME + ' will delete or anonymize the data relating to that user that is no longer necessary for legitimate or operational retention purposes, within a reasonable period of time.',
          },
          {
            type: 'p',
            text: 'We may confirm completion of the request by replying to the email address from which the request was sent.',
          },
        ],
      },
      {
        heading: 'Data That May Be Retained',
        blocks: [
          {
            type: 'p',
            text: 'Some data may need to be retained for a reasonable period where required for legal, financial, security, audit or anti-fraud purposes, or to comply with applicable obligations. Such data will be kept only for as long as necessary for those purposes, and will not be used for other purposes.',
          },
        ],
      },
      {
        heading: 'Contact',
        blocks: [
          { type: 'p', text: LEGAL_ENTITY },
          { type: 'p', text: `Application: ${APP_NAME}` },
          email,
          website,
        ],
      },
    ],
  },
};
