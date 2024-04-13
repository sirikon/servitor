'use strict';

const poring = (() => {

    // #region Signals

    const scopeContext = {
        active: false,
        params: null,
        createdSignals: null,
        createdEffects: null,
    };

    const signalTrackingContext = {
        active: false,
        accessedSignals: null
    }

    class Signal {
        constructor(initialValue) {
            this.value = initialValue == null ? null : initialValue;
            this.listeners = [];
            if (scopeContext.active) {
                scopeContext.createdSignals.push(this);
            }
        }

        get() {
            if (
                signalTrackingContext.active
                && signalTrackingContext.accessedSignals.indexOf(this) === -1
            ) {
                signalTrackingContext.accessedSignals.push(this);
            }
            return this.value;
        }

        set(_arg) {
            const newValue = typeof _arg === "function"
                ? _arg(this.value)
                : _arg;
            if (this.value !== newValue) {
                this.value = newValue;
                const listeners = [...this.listeners];
                for (const listener of listeners) {
                    listener();
                }
            }
        }

        listen(cb) {
            if (this.listeners.indexOf(cb) === -1) {
                this.listeners.push(cb);
            }
        }

        unlisten(cb) {
            const pos = this.listeners.indexOf(cb);
            if (pos >= 0) {
                this.listeners.splice(pos, 1);
            }
        }

        dispose() {
            this.listeners.splice(0, this.listeners.length);
        }
    }
    function useSignal(initialValue) { return new Signal(initialValue); }

    function trackSignals(cb) {
        const oldAccessedSignals = signalTrackingContext.accessedSignals;
        signalTrackingContext.accessedSignals = [];
        cb();
        const accessedSignals = signalTrackingContext.accessedSignals;
        signalTrackingContext.accessedSignals = oldAccessedSignals;
        return accessedSignals;
    }

    function useEffect(cb) {
        const dependedSignals = [];

        let cleanup_func = null;
        function cleanup() {
            typeof cleanup_func === "function" && cleanup_func();
        }

        function execute() {
            cleanup();
            const newDependedSignals = trackSignals(() => {
                cleanup_func = cb();
            });

            for (let i = dependedSignals.length - 1; i >= 0; i--) {
                const signal = dependedSignals[i];
                if (newDependedSignals.indexOf(signal) === -1) {
                    signal.unlisten(execute);
                    dependedSignals.splice(i, 1);
                }
            }

            for (const signal of newDependedSignals) {
                if (dependedSignals.indexOf(signal) === -1) {
                    signal.listen(execute);
                    dependedSignals.push(signal);
                }
            }
        }

        function dispose() {
            for (const signal of dependedSignals) {
                signal.unlisten(execute);
            }
            dependedSignals.splice(0, dependedSignals.length);
            cleanup();
        }

        if (scopeContext.active) {
            scopeContext.createdEffects.push({ dispose });
        }

        execute();

        return { dispose, execute };
    }

    function useComputed(cb) {
        const signal = useSignal()
        const effect = useEffect(() => {
            signal.set(cb())
        })
        return {
            get: () => signal.get(),
            execute: () => effect.execute(),
            dispose: () => {
                effect.dispose();
                signal.dispose();
            }
        };
    }

    function runScope(params, cb) {
        const oldActive = scopeContext.active;
        const oldParams = scopeContext.params;
        const oldCreatedSignals = scopeContext.createdSignals;
        const oldCreatedEffects = scopeContext.createdEffects;

        scopeContext.active = true;
        scopeContext.params = params;
        scopeContext.createdSignals = [];
        scopeContext.createdEffects = [];

        cb();
        const signals = scopeContext.createdSignals;
        const effects = scopeContext.createdEffects;

        scopeContext.active = oldActive;
        scopeContext.params = oldParams;
        scopeContext.createdSignals = oldCreatedSignals;
        scopeContext.createdEffects = oldCreatedEffects;

        function dispose() {
            for (const effect of effects) {
                effect.dispose();
            }
            for (const signal of signals) {
                signal.dispose();
            }
        }

        return { dispose };
    }

    // #endregion

    // #region Rendering

    const EVENT_LISTENER_ATTRIBUTES = ["onclick", "onchange", "oninput"];

    const ELEMENT_ODDITIES = {
        'input': {
            onBuild: (el, props) => {
                if (props.type === 'checkbox') {
                    props.checked
                        ? el.setAttribute('checked', '')
                        : el.removeAttribute('checked');
                    el.checked = !!props.checked;
                }
            },
            onPatch: (oldEl, newEl) => {
                const type = oldEl.getAttribute('type');
                if (type === 'text') {
                    if (oldEl.value !== newEl.value) {
                        oldEl.value = newEl.value;
                    }
                }
                if (type === 'checkbox') {
                    oldEl.checked = newEl.checked;
                }
            }
        }
    }

    function h(tag, _props, _children) {
        const props = _props || {};
        const children = normalizeChildren(_children);

        const el = document.createElement(tag);

        for (const key in props) {
            if (EVENT_LISTENER_ATTRIBUTES.indexOf(key) >= 0) {
                el[key] = props[key];
            } else {
                el.setAttribute(key, props[key]);
            }
        }
        ELEMENT_ODDITIES[tag]?.onBuild(el, props);

        for (const _child of children) {
            if (_child == null || typeof _child === "boolean") {
                continue
            }

            const child = ['string', 'number'].includes(typeof _child)
                ? document.createTextNode(_child.toString())
                : _child;
            el.appendChild(child);
        }

        return el;
    }

    function normalizeChildren(children) {
        if (Array.isArray(children)) {
            return children;
        }
        if (children != null) {
            return [children];
        }
        return [];
    }

    function patchDom(root, content) {
        if (content == null || (Array.isArray(content) && content.length === 0)) {
            root.innerHTML = '';
            return;
        }

        const oldNodes = [...root.childNodes];
        const newNodes = (Array.isArray(content) ? content : [content])
            .filter(n => n != null && typeof n !== "boolean");

        const leftOverElements = oldNodes.length - newNodes.length;
        for (let i = leftOverElements; i > 0; i--) {
            const el = oldNodes[oldNodes.length - i];
            el.parentNode.removeChild(el);
        }

        for (const i in newNodes) {
            const newNode = newNodes[i];
            const oldNode = oldNodes[i];

            if (!oldNode) {
                root.appendChild(newNode);
                continue;
            }

            const newNodeType = getNodeType(newNode);
            const oldNodeType = getNodeType(oldNode);
            if (newNodeType !== oldNodeType) {
                oldNode.parentNode.replaceChild(newNode, oldNode);
                continue;
            }

            if (!["text", "comment"].includes(newNodeType)) {
                const newNodeAttributeNames = newNode.getAttributeNames();
                const oldNodeAttributeNames = oldNode.getAttributeNames();
                for (const attr of oldNodeAttributeNames) {
                    if (!newNodeAttributeNames.includes(attr)) {
                        oldNode.removeAttribute(attr);
                    }
                }
                for (const attr of newNodeAttributeNames) {
                    oldNode.setAttribute(attr, newNode.getAttribute(attr));
                }
            }

            if (oldNode instanceof PoringElement) {
                continue;
            }

            for (const event of EVENT_LISTENER_ATTRIBUTES) {
                oldNode[event] = newNode[event];
            }

            const newNodeContent = getNodeTextContent(newNode);
            if (newNodeContent != null && newNodeContent !== getNodeTextContent(oldNode)) {
                oldNode.textContent = newNodeContent;
            }

            ELEMENT_ODDITIES[newNodeType]?.onPatch(oldNode, newNode);

            if (newNode.childNodes.length === 0) {
                oldNode.innerHTML = '';
                continue;
            }

            if (oldNode.childNodes.length === 0 && newNode.childNodes.length > 0) {
                const fragment = document.createDocumentFragment();
                patchDom(fragment, [...newNode.childNodes]);
                oldNode.appendChild(fragment);
                continue;
            }

            if (newNode.childNodes.length > 0) {
                patchDom(oldNode, [...newNode.childNodes]);
            }
        }

    }

    function getNodeType(node) {
        if (node.nodeType === 3) return 'text';
        if (node.nodeType === 8) return 'comment';
        return node.tagName.toLowerCase();
    };

    function getNodeTextContent(node) {
        if (node.childNodes && node.childNodes.length > 0) return null;
        return node.textContent;
    };

    class PoringElement extends HTMLElement { }

    // #endregion

    // #region Components

    function component(tag, attributes, logic) {
        class Component extends PoringElement {
            static observedAttributes = attributes;
            constructor() {
                super();
                this.attributeSignals = null;
                this.scope = null;
            }

            build() {
                this.scope = scope({ component: this }, () => {
                    this.attributeSignals = Object.fromEntries(attributes.map(attr => [attr, signal(this.getAttribute(attr))]));
                    logic(this.attributeSignals, this);
                })
            }

            attributeChangedCallback(name, oldValue, newValue) {
                if (this.attributeSignals == null) return;
                this.attributeSignals[name].set(newValue);
            }

            connectedCallback() {
                this.build();
            }

            disconnectedCallback() {
                this.scope.dispose();
            }
        }
        customElements.define(tag, Component);
    }

    function useBaseRenderer(cb) {
        const component = scopeContext.params.component;
        useEffect(() => cb(component));
    }

    function useRenderer(cb) {
        useBaseRenderer((c) => patchDom(c, cb()))
    }

    // #endregion    

    return { useSignal, useEffect, useComputed, component, h, useBaseRenderer, useRenderer, patchDom }
})();
