export const isScreenshotMode = process.env.NEXT_PUBLIC_SCREENSHOT_MODE === 'true';

export const appDisplayName = isScreenshotMode ? 'Network Support Workbench' : 'Network Vcode';
