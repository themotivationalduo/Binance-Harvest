// Polyfill protection for environments with strict getters on Window / Window.prototype
(function initPolyfillGuard() {
  if (typeof window === 'undefined') return;

  function makeSettable(targetObj: any, prop: string) {
    if (!targetObj) return;

    // 1. Walk the prototype chain to ensure any existing getter also has a setter
    let p = targetObj;
    while (p) {
      try {
        const desc = Object.getOwnPropertyDescriptor(p, prop);
        if (desc) {
          if (desc.get && !desc.set) {
            const origGet = desc.get;
            try {
              Object.defineProperty(p, prop, {
                get: origGet,
                set: function (val: any) {
                  try {
                    Object.defineProperty(this, prop, {
                      value: val,
                      writable: true,
                      configurable: true,
                      enumerable: true,
                    });
                  } catch (_) {
                    this[prop] = val;
                  }
                },
                configurable: true,
                enumerable: desc.enumerable,
              });
            } catch (_) {}
          }
          break;
        }
      } catch (_) {}
      p = Object.getPrototypeOf(p);
    }

    // 2. Define an accessor on targetObj directly so instances inheriting from it can set 'this[prop]'
    try {
      let currentVal = targetObj[prop];
      Object.defineProperty(targetObj, prop, {
        get: function () {
          return currentVal;
        },
        set: function (val: any) {
          if (this === targetObj) {
            currentVal = val;
          } else {
            try {
              Object.defineProperty(this, prop, {
                value: val,
                writable: true,
                configurable: true,
                enumerable: true,
              });
            } catch (_) {
              this[prop] = val;
            }
          }
        },
        configurable: true,
        enumerable: true,
      });
    } catch (_) {}
  }

  try {
    makeSettable(window, 'fetch');
    makeSettable(window, 'Headers');
    makeSettable(window, 'Request');
    makeSettable(window, 'Response');
    if (typeof globalThis !== 'undefined' && globalThis !== window) {
      makeSettable(globalThis, 'fetch');
    }
  } catch (e) {
    console.warn('Polyfill guard warning:', e);
  }
})();

export {};
