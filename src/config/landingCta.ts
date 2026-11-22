import { IS_DEMO } from '../demo/demoMode'

/** Landing page call-to-action copy: accounts in the normal build, the demo in the demo build (M11). */
export const CTA_COPY = IS_DEMO
  ? {
      primary: 'View demo',
      secondary: 'Source on GitHub',
      heroNote: 'Live demo with fictional sample data. No sign-up, and nothing leaves your browser.',
      finalText: 'Open the demo, explore the sample projects, and let the scheduler propose work sessions.',
    }
  : {
      primary: 'Get started',
      secondary: 'Log in',
      heroNote: 'Email and password account. Your tasks stay private to your account.',
      finalText: 'Create an account, add a project, and let the scheduler propose your first work sessions.',
    }
