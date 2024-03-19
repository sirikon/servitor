'use strict';

const Framework = (() => {

    const Hooks = (() => {

        const context = {
            component: null,
            states: null,
            hookCounter: 0
        };

        function withComponent(component, states, cb) {
            const oldContext = {
                component: context.component,
                states: context.states,
                hookCounter: context.hookCounter
            };
            context.component = component;
            context.states = states;
            context.hookCounter = 0;
            let result;
            try {
                result = cb();
            } catch (err) {
                console.error(err);
            }
            context.component = oldContext.component;
            context.states = oldContext.states;
            context.hookCounter = oldContext.hookCounter;
            return result;
        }

        function useHook(cb) {
            if (context.component == null) {
                throw new Error("Hook used outside of element")
            }
            const state =
                context.states[context.hookCounter] =
                context.states[context.hookCounter] || {}
            const result = cb(state);
            context.hookCounter++;
            return result;
        }

        function useRef(initialValue) {
            return useHook((state) => {
                if (!state.initialized) {
                    state.initialized = true;
                    state.ref = {
                        current: initialValue
                    }
                }
                return state.ref;
            });
        }

        function useState(initialValue) {
            return useHook((state) => {
                if (!state.initialized) {
                    state.initialized = true;
                    state.component = context.component;
                    state.value = initialValue;
                    state.setter = (_arg) => {
                        const newValue = typeof _arg === "function"
                            ? _arg(state.value)
                            : _arg;
                        if (state.value != newValue) {
                            state.value = newValue;
                            state.component.refresh();
                        }
                    }
                }
                return [state.value, state.setter];
            });
        }

        function useEffect(cb, busters) {
            return useHook((state) => {
                if (!state.initialized || !bustersAreEqual(state.busters, busters)) {
                    state.initialized = true;
                    state.busters = busters;
                    if (state.cleanup != null) {
                        state.cleanup();
                    }
                    state.cleanup = cb();
                }
            });
        }

        function useCallback(cb, busters) {
            return useHook((state) => {
                if (!state.initialized || !bustersAreEqual(state.busters, busters)) {
                    state.initialized = true;
                    state.busters = busters;
                    state.cb = cb;
                }
                return state.cb;
            });
        }

        function usePostRenderEffect(cb) {
            return useHook((state) => {
                state.postRenderCallback = cb;
            });
        }

        function useCustomDomPatcher(cb) {
            return useHook((state) => {
                state.customDomPatcher = cb;
            });
        }

        function bustersAreEqual(oldBusters, newBusters) {
            if (oldBusters.length != newBusters.length) {
                return false;
            }
            for (let i = 0; i < oldBusters.length; i++) {
                if (oldBusters[i] != newBusters[i]) {
                    return false
                }
            }
            return true
        }

        window.useEffect = useEffect;
        window.useState = useState;
        window.useRef = useRef;
        window.useCallback = useCallback;
        window.usePostRenderEffect = usePostRenderEffect;
        window.useCustomDomPatcher = useCustomDomPatcher;

        return { withComponent }

    })();

    const Rendering = (() => {
        const EVENT_LISTENER_ATTRIBUTES = ["onclick", "onchange", "oninput"];

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

        class ServitorComponent extends HTMLElement { }

        function component() {
            const { tag, attributes, logic } = ((args) => {
                if (args.length === 3) {
                    return { tag: args[0], attributes: args[1], logic: args[2] };
                } else if (arguments.length === 2) {
                    return { tag: args[0], attributes: [], logic: args[1] };
                }
            })(arguments);

            class Component extends ServitorComponent {
                static observedAttributes = attributes;

                constructor() {
                    super();
                    this.__hookState = [];
                    this.connected = false;
                    this.refreshing = false;
                    this.refreshQueued = false;
                }

                refresh() {
                    if (!this.connected) return;
                    if (this.refreshing) {
                        this.refreshQueued = true;
                        return
                    };

                    try {
                        this.refreshing = true;
                        while (true) {
                            this.refreshQueued = false;
                            const renderResult = this.render();
                            const customDomPatcher = this.__hookState.find(s => s.customDomPatcher)?.customDomPatcher;
                            if (customDomPatcher) {
                                customDomPatcher(this, renderResult);
                            } else {
                                patchDom(this, renderResult);
                            }
                            for (const hookState of this.__hookState) {
                                if (hookState.postRenderCallback) {
                                    hookState.postRenderCallback(this);
                                }
                            }

                            if (!this.refreshQueued) {
                                break
                            }
                        }
                    } finally {
                        this.refreshing = false;
                    }
                }

                render() {
                    const attrs = Object.fromEntries(attributes.map(attr => [attr, this.getAttribute(attr)]));
                    return Hooks.withComponent(this, this.__hookState, () => logic(attrs));
                }

                attributeChangedCallback(name, oldValue, newValue) {
                    if (oldValue != newValue) {
                        this.refresh();
                    }
                }

                connectedCallback() {
                    this.connected = true;
                    this.refresh();
                }

                disconnectedCallback() {
                    this.connected = false;
                    for (const hookState of this.__hookState) {
                        if (hookState.cleanup != null) {
                            hookState.cleanup();
                        }
                    }
                }
            }
            customElements.define(tag, Component)
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

                if (oldNode instanceof ServitorComponent) {
                    continue;
                }

                for (const event of EVENT_LISTENER_ATTRIBUTES) {
                    oldNode[event] = newNode[event];
                }

                const newNodeContent = getNodeTextContent(newNode);
                if (newNodeContent != null && newNodeContent !== getNodeTextContent(oldNode)) {
                    oldNode.textContent = newNodeContent;
                }

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

        window.h = h;
        window.component = component;

    })();

})();
