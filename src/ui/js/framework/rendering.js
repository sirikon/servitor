'use strict';

function h(tag, _props, _children) {
    const props = _props || {};
    const children = _children || [];
    const el = document.createElement(tag);
    for (const key in props) {
        if (['onclick'].indexOf(key) >= 0) {
            el.addEventListener(key.substring(2), props[key]);
        } else {
            el.setAttribute(key, props[key]);
        }
    }
    if (typeof children === 'string') {
        el.textContent = children;
    } else {
        for (const child of children) {
            el.appendChild(child);
        }
    }
    return el;
}

function component(tag, logic) {
    class Component extends HTMLElement {
        constructor() {
            super();
            log('INIT', tag);
            this.logicResult = logic(this);
        }

        refresh() {
            log('REFRESH', tag);
            this.replaceChildren(this.render());
        }

        render() {
            if (typeof this.logicResult === "function") {
                return this.logicResult();
            } else {
                return this.logicResult.render();
            }
        }

        onDisconnected() {
            if (this.logicResult.onDisconnected) {
                this.logicResult.onDisconnected();
            }
        }

        connectedCallback() {
            log('CONNECTED', tag);
            this.refresh();
        }

        disconnectedCallback() {
            log('DISCONNECTED', tag);
            this.onDisconnected();
        }
    }
    customElements.define(tag, Component)
}

function log() {
    // console.log(...arguments)
}
