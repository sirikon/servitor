function h(tag, props, children) {
    const el = document.createElement(tag);
    for (const key in props) {
        el.setAttribute(key, props[key]);
    }
    if (typeof children === 'string') {
        el.textContent = children;
    } else {
        if (children.length > 0) {
            el.appendChild(...children);
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

    disconnectedCallback() {
        console.log('disconnected', this);
    }
}

function registerComponent(componentClazz) {
    const tag = "x-" + componentClazz.name
        .replace(/Component$/, '')
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '');
    customElements.define(tag, componentClazz);
}
