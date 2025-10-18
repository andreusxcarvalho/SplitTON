import WebApp from "@twa-dev/sdk";

// Initialize Telegram Mini App SDK
WebApp.ready();

// Expand the app to full height
WebApp.expand();

// Configure theme and appearance
WebApp.setHeaderColor(WebApp.themeParams.bg_color || "#FFFFFF");
WebApp.setBackgroundColor(WebApp.themeParams.bg_color || "#FFFFFF");

// Enable closing confirmation
WebApp.enableClosingConfirmation();

export default WebApp;
