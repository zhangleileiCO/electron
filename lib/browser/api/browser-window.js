'use strict';

const electron = require('electron');
const { WebContentsView, TopLevelWindow, deprecate } = electron;
const { BrowserWindow } = process.electronBinding('window');

Object.setPrototypeOf(BrowserWindow.prototype, TopLevelWindow.prototype);

BrowserWindow.prototype._init = function () {
  // Call parent class's _init.
  TopLevelWindow.prototype._init.call(this);

  // Avoid recursive require.
  const { app } = electron;

  // Create WebContentsView.
  this.setContentView(new WebContentsView(this.webContents));

  const nativeSetBounds = this.setBounds;
  this.setBounds = (bounds, ...opts) => {
    bounds = {
      ...this.getBounds(),
      ...bounds
    };
    nativeSetBounds.call(this, bounds, ...opts);
  };

  // Sometimes the webContents doesn't get focus when window is shown, so we
  // have to force focusing on webContents in this case. The safest way is to
  // focus it when we first start to load URL, if we do it earlier it won't
  // have effect, if we do it later we might move focus in the page.
  //
  // Though this hack is only needed on macOS when the app is launched from
  // Finder, we still do it on all platforms in case of other bugs we don't
  // know.
  this.webContents.once('load-url', function () {
    this.focus();
  });

  // Redirect focus/blur event to app instance too.
  this.on('blur', (event) => {
    app.emit('browser-window-blur', event, this);
  });
  this.on('focus', (event) => {
    app.emit('browser-window-focus', event, this);
  });

  // Subscribe to visibilityState changes and pass to renderer process.
  let isVisible = this.isVisible() && !this.isMinimized();
  const visibilityChanged = () => {
    const newState = this.isVisible() && !this.isMinimized();
    if (isVisible !== newState) {
      isVisible = newState;
      const visibilityState = isVisible ? 'visible' : 'hidden';
      this.webContents.emit('-window-visibility-change', visibilityState);
    }
  };

  const visibilityEvents = ['show', 'hide', 'minimize', 'maximize', 'restore'];
  for (const event of visibilityEvents) {
    this.on(event, visibilityChanged);
  }

  // Notify the creation of the window.
  const event = process.electronBinding('event').createEmpty();
  app.emit('browser-window-created', event, this);

  Object.defineProperty(this, 'devToolsWebContents', {
    enumerable: true,
    configurable: false,
    get () {
      return this.webContents.devToolsWebContents;
    }
  });
};

// Properties

Object.defineProperty(BrowserWindow.prototype, 'autoHideMenuBar', {
  get: function () { return this.isMenuBarAutoHide(); },
  set: function (autoHide) { this.setAutoHideMenuBar(autoHide); }
});

Object.defineProperty(BrowserWindow.prototype, 'visibleOnAllWorkspaces', {
  get: function () { return this.isVisibleOnAllWorkspaces(); },
  set: function (visible) { this.setVisibleOnAllWorkspaces(visible); }
});

Object.defineProperty(BrowserWindow.prototype, 'simpleFullScreen', {
  get: function () { return this.isSimpleFullScreen(); },
  set: function (simple) { this.setSimpleFullScreen(simple); }
});

Object.defineProperty(BrowserWindow.prototype, 'kiosk', {
  get: function () { return this.isKiosk(); },
  set: function (kiosk) { this.setKiosk(kiosk); }
});

Object.defineProperty(BrowserWindow.prototype, 'documentEdited', {
  get: function () { return this.isFullscreen(); },
  set: function (edited) { this.setDocumentEdited(edited); }
});

Object.defineProperty(BrowserWindow.prototype, 'shadow', {
  get: function () { return this.hasShadow(); },
  set: function (shadow) { this.setHasShadow(shadow); }
});

Object.defineProperty(BrowserWindow.prototype, 'representedFilename', {
  get: function () { return this.getRepresentedFilename(); },
  set: function (filename) { this.setRepresentedFilename(filename); }
});

Object.defineProperty(BrowserWindow.prototype, 'minimizable', {
  get: function () { return this.isMinimizable(); },
  set: function (min) { this.setMinimizable(min); }
});

Object.defineProperty(BrowserWindow.prototype, 'title', {
  get: function () { return this.getTitle(); },
  set: function (title) { this.setTitle(title); }
});

Object.defineProperty(BrowserWindow.prototype, 'maximizable', {
  get: function () { return this.isMaximizable(); },
  set: function (max) { this.setMaximizable(max); }
});

Object.defineProperty(BrowserWindow.prototype, 'resizable', {
  get: function () { return this.isResizable(); },
  set: function (res) { this.setResizable(res); }
});

Object.defineProperty(BrowserWindow.prototype, 'menuBarVisible', {
  get: function () { return this.isMenuBarVisible(); },
  set: function (visible) { this.setMenuBarVisibility(visible); }
});

Object.defineProperty(BrowserWindow.prototype, 'fullScreenable', {
  get: function () { return this.isFullScreenable(); },
  set: function (full) { this.setFullScreenable(full); }
});

Object.defineProperty(BrowserWindow.prototype, 'closable', {
  get: function () { return this.isClosable(); },
  set: function (close) { this.setClosable(close); }
});

Object.defineProperty(BrowserWindow.prototype, 'movable', {
  get: function () { return this.isMovable(); },
  set: function (move) { this.setMovable(move); }
});

const isBrowserWindow = (win) => {
  return win && win.constructor.name === 'BrowserWindow';
};

BrowserWindow.fromId = (id) => {
  const win = TopLevelWindow.fromId(id);
  return isBrowserWindow(win) ? win : null;
};

BrowserWindow.getAllWindows = () => {
  return TopLevelWindow.getAllWindows().filter(isBrowserWindow);
};

BrowserWindow.getFocusedWindow = () => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isFocused() || window.isDevToolsFocused()) return window;
  }
  return null;
};

BrowserWindow.fromWebContents = (webContents) => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.webContents && window.webContents.equal(webContents)) return window;
  }

  return null;
};

BrowserWindow.fromBrowserView = (browserView) => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.getBrowserView() === browserView) return window;
  }

  return null;
};

// Helpers.
Object.assign(BrowserWindow.prototype, {
  loadURL (...args) {
    return this.webContents.loadURL(...args);
  },
  getURL (...args) {
    return this.webContents.getURL();
  },
  loadFile (...args) {
    return this.webContents.loadFile(...args);
  },
  reload (...args) {
    return this.webContents.reload(...args);
  },
  send (...args) {
    return this.webContents.send(...args);
  },
  openDevTools (...args) {
    return this.webContents.openDevTools(...args);
  },
  closeDevTools () {
    return this.webContents.closeDevTools();
  },
  isDevToolsOpened () {
    return this.webContents.isDevToolsOpened();
  },
  isDevToolsFocused () {
    return this.webContents.isDevToolsFocused();
  },
  toggleDevTools () {
    return this.webContents.toggleDevTools();
  },
  inspectElement (...args) {
    return this.webContents.inspectElement(...args);
  },
  inspectSharedWorker () {
    return this.webContents.inspectSharedWorker();
  },
  inspectServiceWorker () {
    return this.webContents.inspectServiceWorker();
  },
  showDefinitionForSelection () {
    return this.webContents.showDefinitionForSelection();
  },
  capturePage (...args) {
    return this.webContents.capturePage(...args);
  },
  setTouchBar (touchBar) {
    electron.TouchBar._setOnWindow(touchBar, this);
  },
  setBackgroundThrottling (allowed) {
    this.webContents.setBackgroundThrottling(allowed);
  }
});

module.exports = BrowserWindow;
