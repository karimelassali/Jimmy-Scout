import { TabId } from '../navigation/BottomBar';

export interface TourStep {
  id: string;
  tab: TabId;
  target: string;
  title: string;
  plainEnglish: string;
  whatItDoes: string;
  tip?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export const FULL_APP_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome-overview',
    tab: 'control',
    target: '[data-tour="nav-tabs"]',
    title: 'Welcome to JimyScout! 🚀',
    plainEnglish:
      'Meet Jimy, your automated Swiss equipment scout agent. Jimy scans Swiss construction companies, sends friendly inquiries, and brings you machine offers.',
    whatItDoes:
      'These top tabs let you navigate: Dashboard, Deals (seller replies), Regions (areas to email), and Settings (your profile).',
    tip: 'Click any tab anytime to jump between sections.',
    position: 'bottom',
  },
  {
    id: 'auto-scout-switch',
    tab: 'control',
    target: '[data-tour="auto-scout-switch"]',
    title: 'Put Jimy to Work ⚡',
    plainEnglish:
      'This is the main switch for agent Jimy. When enabled, Jimy is working and automatically sends emails during Swiss business hours (08:30 - 17:00). When paused, Jimy is waiting on standby.',
    whatItDoes:
      'Toggles Jimy between Working and Waiting. While working, Jimy contacts companies in your selected areas.',
    tip: 'Keep Jimy working during weekdays to continuously generate machinery deals.',
    position: 'bottom',
  },
  {
    id: 'daily-limit-slider',
    tab: 'control',
    target: '[data-tour="daily-limit-slider"]',
    title: "Jimy's Daily Speed Limit 🎯",
    plainEnglish:
      'Controls how many Swiss construction companies Jimy emails per day. Keeps your email address healthy and trusted.',
    whatItDoes:
      'Drag this slider to set Jimy’s daily volume (e.g. 20-30 emails/day). Jimy strictly respects this limit.',
    tip: 'Recommended: 20-25 emails/day for best results.',
    position: 'bottom',
  },
  {
    id: 'manual-dispatch-btn',
    tab: 'control',
    target: '[data-tour="manual-dispatch-btn"]',
    title: 'Ask Jimy to Send 1 Email ✉️',
    plainEnglish:
      'Want Jimy to send right now without waiting? Jimy sends a single introductory email immediately to the next company on the list.',
    whatItDoes:
      'Picks the next company from your list, prepares the message in their language (German, French, or Italian), and sends it.',
    tip: 'Great for verifying that Jimy’s email setup is working smoothly.',
    position: 'bottom',
  },
  {
    id: 'poll-imap-btn',
    tab: 'control',
    target: '[data-tour="poll-imap-btn"]',
    title: 'Ask Jimy to Check Replies 📥',
    plainEnglish:
      'Asks Jimy to check your inbox right away for new responses from contractors who wrote back.',
    whatItDoes:
      'Jimy checks your email inbox, pulls new replies, and reads the equipment names and prices.',
    tip: 'Jimy checks automatically, but click this whenever you want to see replies immediately.',
    position: 'bottom',
  },
  {
    id: 'pipeline-stats',
    tab: 'control',
    target: '[data-tour="pipeline-stats"]',
    title: 'Activity Summary 📊',
    plainEnglish:
      'Quick glance at your numbers: Companies on your list, emails sent today, offers received, and closed purchases.',
    whatItDoes:
      'Live numbers so you always know how your outreach is performing.',
    position: 'top',
  },
  {
    id: 'process-inbound-btn',
    tab: 'leads',
    target: '[data-tour="process-inbound-btn"]',
    title: 'Paste a Seller Reply 🤖',
    plainEnglish:
      'Got a reply from a contractor via email, WhatsApp, or phone? Paste it here and the app will read it automatically!',
    whatItDoes:
      'Pulls out machine make/model, year, asking price, and creates a deal card for you with a phone button.',
    tip: 'Try pasting: "We are selling a 2019 CAT 320 excavator for 85,000 CHF".',
    position: 'bottom',
  },
  {
    id: 'leads-status-tabs',
    tab: 'leads',
    target: '[data-tour="leads-status-tabs"]',
    title: 'Filter Deals 📋',
    plainEnglish:
      'Organize your conversations easily. Filter offers into New, Contacted, Yard Inspection, or Purchased.',
    whatItDoes:
      'Click any filter tab to see only matching deals so you can focus on sellers ready to sell.',
    position: 'bottom',
  },
  {
    id: 'canton-selection',
    tab: 'targets',
    target: '[data-tour="canton-selection"]',
    title: 'Swiss Regions 🗺️',
    plainEnglish:
      'Choose which areas of Switzerland to target. Switzerland has 26 cantons spanning French, German, and Italian regions.',
    whatItDoes:
      'Click region cards to turn them ON or OFF. The app writes in German for Bern/Zürich, French for Vaud/Geneva, and Italian for Ticino!',
    tip: 'Start with 3 to 6 popular regions like Bern, Vaud, and Zürich.',
    position: 'bottom',
  },
  {
    id: 'company-database',
    tab: 'targets',
    target: '[data-tour="company-database"]',
    title: 'Company List 🏗️',
    plainEnglish:
      'Your verified list of Swiss construction, demolition, and earthworks companies.',
    whatItDoes:
      'Search companies, filter by region, view email and phone numbers, and see who has been emailed.',
    position: 'top',
  },
  {
    id: 'persona-identity',
    tab: 'persona',
    target: '[data-tour="persona-identity"]',
    title: 'Your Profile & Phone 👤',
    plainEnglish:
      'This is your name and info that Swiss companies see in their email. Enter your name, email, and phone number.',
    whatItDoes:
      'Updates your sender name, email address, direct phone number, and machinery wanted.',
    tip: 'Contractors prefer seeing a real mobile number (+41 79 ...).',
    position: 'right',
  },
  {
    id: 'persona-tone',
    tab: 'persona',
    target: '[data-tour="persona-tone"]',
    title: 'Speaking Style 🗣️',
    plainEnglish:
      'Swiss business culture values respect and directness. Choose the style of your email.',
    whatItDoes:
      'Switch between Swiss Formal (polite & respectful), Friendly Contractor Style (approachable), or Fast Payment Deal (quick cash buyout).',
    position: 'left',
  },
  {
    id: 'persona-hooks',
    tab: 'persona',
    target: '[data-tour="persona-hooks"]',
    title: 'Guarantees You Offer 🪝',
    plainEnglish:
      'The 3 strong reasons contractors sell equipment to you directly instead of auctions.',
    whatItDoes:
      'Toggle: Fast Wire Payment (money upfront), Transport Covered (you handle trucks), and As-Is Purchase (no warranty hassle).',
    tip: 'Keeping all 3 checked yields the highest response rate!',
    position: 'left',
  },
  {
    id: 'persona-test-email',
    tab: 'persona',
    target: '[data-tour="persona-test-email"]',
    title: 'Preview Email & Send Test 📬',
    plainEnglish:
      'Read the exact email sent in French, German, or Italian, and send a test email to your own address.',
    whatItDoes:
      'Shows how company names and regions appear, and lets you test sending an email.',
    position: 'top',
  },
];

export const SCREEN_SPECIFIC_TOURS: Record<TabId, TourStep[]> = {
  control: [
    {
      id: 'control-switch',
      tab: 'control',
      target: '[data-tour="auto-scout-switch"]',
      title: 'Automatic Emailing Switch ⚡',
      plainEnglish:
        'Turns on automated emailing during Swiss business hours. When green, the app sends emails according to your daily limit.',
      whatItDoes: 'Toggles automatic background emailing ON/OFF.',
      position: 'bottom',
    },
    {
      id: 'control-limit',
      tab: 'control',
      target: '[data-tour="daily-limit-slider"]',
      title: 'Daily Speed Limit 🎯',
      plainEnglish:
        'Controls maximum emails sent per day. Set between 10 and 50 to maintain a safe, natural sending pace.',
      whatItDoes: 'Sets the daily sending limit for your campaign.',
      position: 'bottom',
    },
    {
      id: 'control-buttons',
      tab: 'control',
      target: '[data-tour="manual-dispatch-btn"]',
      title: 'Send 1 Email Right Now ✉️',
      plainEnglish:
        'Immediately writes and sends an introductory email to the next company on your list.',
      whatItDoes: 'Sends 1 email right now.',
      position: 'bottom',
    },
    {
      id: 'control-imap',
      tab: 'control',
      target: '[data-tour="poll-imap-btn"]',
      title: 'Check for Replies 📥',
      plainEnglish:
        'Checks your inbox for new incoming replies and reads the machinery offers inside.',
      whatItDoes: 'Pulls incoming emails and pulls out machine offers.',
      position: 'bottom',
    },
    {
      id: 'control-stats',
      tab: 'control',
      target: '[data-tour="pipeline-stats"]',
      title: 'Activity Summary 📊',
      plainEnglish:
        'Quick summary of your numbers: companies on list, emails sent today, offers received, and closed purchases.',
      whatItDoes: 'Live tracking of your business activity.',
      position: 'top',
    },
  ],
  leads: [
    {
      id: 'leads-process',
      tab: 'leads',
      target: '[data-tour="process-inbound-btn"]',
      title: 'Paste a Seller Reply 🤖',
      plainEnglish:
        'Paste any email or message from a seller here. The app extracts machine model, asking price, and contact info in seconds.',
      whatItDoes: 'Reads seller reply into a clean offer card.',
      position: 'bottom',
    },
    {
      id: 'leads-filters',
      tab: 'leads',
      target: '[data-tour="leads-status-tabs"]',
      title: 'Filter Deals 📋',
      plainEnglish:
        'Filter between New replies, Excavators, Trucks, or deals you are inspecting.',
      whatItDoes: 'Filters your deal cards by status.',
      position: 'bottom',
    },
  ],
  targets: [
    {
      id: 'targets-cantons',
      tab: 'targets',
      target: '[data-tour="canton-selection"]',
      title: 'Select Regions 🗺️',
      plainEnglish:
        'Click regions to turn them on or off. The app automatically speaks the local language (German, French, Italian).',
      whatItDoes: 'Enables or disables emailing in that region.',
      position: 'bottom',
    },
    {
      id: 'targets-directory',
      tab: 'targets',
      target: '[data-tour="company-database"]',
      title: 'Company List 🏗️',
      plainEnglish:
        'All Swiss construction, demolition, and excavation companies on your list.',
      whatItDoes: 'Search and inspect company contact info and status.',
      position: 'top',
    },
  ],
  persona: [
    {
      id: 'persona-info',
      tab: 'persona',
      target: '[data-tour="persona-identity"]',
      title: 'Your Profile 👤',
      plainEnglish:
        'Set your name, your email address, and your Swiss phone number so sellers can contact you.',
      whatItDoes: 'Sets your signature on all emails.',
      position: 'right',
    },
    {
      id: 'persona-tone-select',
      tab: 'persona',
      target: '[data-tour="persona-tone"]',
      title: 'Speaking Style 🗣️',
      plainEnglish:
        'Choose between Swiss Formal, Friendly Contractor Style, or Fast Payment Deal.',
      whatItDoes: 'Changes the writing style of your emails.',
      position: 'left',
    },
    {
      id: 'persona-hooks-select',
      tab: 'persona',
      target: '[data-tour="persona-hooks"]',
      title: 'Guarantees You Offer 🪝',
      plainEnglish:
        'The key benefits you offer: Immediate wire payment, transport covered by you, and buying equipment as-is without warranty.',
      whatItDoes: 'Includes these key points in the email.',
      position: 'left',
    },
    {
      id: 'persona-preview',
      tab: 'persona',
      target: '[data-tour="persona-test-email"]',
      title: 'Email Preview & Test 📬',
      plainEnglish:
        'Read the exact email sent to Swiss companies in French, German, or Italian, and send a live test to yourself.',
      whatItDoes: 'Previews the email and sends a test message.',
      position: 'top',
    },
  ],
};
