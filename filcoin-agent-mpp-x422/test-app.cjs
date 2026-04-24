const { app, BrowserWindow } = require("electron");
console.log("app:", typeof app);
console.log("BrowserWindow:", typeof BrowserWindow);
if (app) {
  app.whenReady().then(() => {
    console.log("app ready!");
    app.quit();
  });
} else {
  process.exit(0);
}
