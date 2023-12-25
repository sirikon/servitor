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

class Component extends HTMLElement {
    refresh() {
        this.innerHTML = '';
        this.appendChild(this.render());
    }

    connectedCallback() {
        this.refresh();
    }

    disconnectedCallback() { }
}

function getComponentTag(componentClazz) {
    return "x-" + componentClazz.name
        .replace(/Component$/, '')
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '');
}

function registerComponent(componentClazz) {
    customElements.define(getComponentTag(componentClazz), componentClazz);
}
