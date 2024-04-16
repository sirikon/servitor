"use strict";
/**
 * Poring - https://github.com/sirikon/poring
 * Author: Carlos Fdez. Llamas <hello@sirikon.me>
 * License: GPL-3.0 https://github.com/sirikon/poring/blob/master/LICENSE
 */
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
    accessedSignals: null,
  };

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
        signalTrackingContext.active &&
        signalTrackingContext.accessedSignals.indexOf(this) === -1
      ) {
        signalTrackingContext.accessedSignals.push(this);
      }
      return this.value;
    }

    set(_arg) {
      const newValue = typeof _arg === "function" ? _arg(this.value) : _arg;
      if (this.value !== newValue) {
        this.value = newValue;
        const listeners = [...this.listeners];
        for (const listener of listeners) {
          listener();
        }
      }
    }

    subscribe(cb) {
      if (this.listeners.indexOf(cb) === -1) {
        this.listeners.push(cb);
      }
    }

    unsubscribe(cb) {
      const pos = this.listeners.indexOf(cb);
      if (pos >= 0) {
        this.listeners.splice(pos, 1);
      }
    }

    dispose() {
      this.listeners.splice(0, this.listeners.length);
    }
  }
  function useSignal(initialValue) {
    return new Signal(initialValue);
  }

  function trackSignals(cb) {
    const oldAccessedSignals = signalTrackingContext.accessedSignals;
    signalTrackingContext.active = true;
    signalTrackingContext.accessedSignals = [];
    cb();
    const accessedSignals = signalTrackingContext.accessedSignals;
    signalTrackingContext.active = false;
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
          signal.unsubscribe(execute);
          dependedSignals.splice(i, 1);
        }
      }

      for (const signal of newDependedSignals) {
        if (dependedSignals.indexOf(signal) === -1) {
          signal.subscribe(execute);
          dependedSignals.push(signal);
        }
      }
    }

    function dispose() {
      for (const signal of dependedSignals) {
        signal.unsubscribe(execute);
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
    const signal = useSignal();
    const effect = useEffect(() => {
      signal.set(cb());
    });
    return {
      get: () => signal.get(),
      execute: () => effect.execute(),
      dispose: () => {
        effect.dispose();
        signal.dispose();
      },
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

  function h() {
    const tag = arguments[0];
    let attributes = {};
    let properties = {};
    let children = [];

    if (arguments.length >= 2 && isObject(arguments[1])) {
      attributes = arguments[1];
    }
    if (arguments.length >= 3 && isObject(arguments[2])) {
      properties = arguments[2];
    }
    if (
      arguments.length > 1 &&
      (Array.isArray(arguments[arguments.length - 1]) ||
        ["string", "number"].includes(typeof arguments[arguments.length - 1]))
    ) {
      const arg = arguments[arguments.length - 1];
      children = Array.isArray(arg) ? arg : [arg];
    }

    return { tag, attributes, properties, children };
  }

  function isObject(v) {
    return typeof v === "object" && !Array.isArray(v);
  }

  function normalizeVNodes(_vNodes) {
    const vNodes = Array.isArray(_vNodes) ? _vNodes : [_vNodes];
    const result = [];
    for (const vNode of vNodes) {
      if (vNode == null) continue;
      const vNodeType = typeof vNode;
      if (!["string", "number", "object"].includes(vNodeType)) continue;
      if (["string", "number"].includes(vNodeType)) {
        result.push(vNode.toString());
        continue;
      }
      result.push({ ...vNode, children: normalizeVNodes(vNode.children) });
    }
    return result;
  }

  function getVNodeType(vNode) {
    if (typeof vNode === "string") return "text";
    return vNode.tag;
  }

  function patchNode(rootNode, vNodes) {
    if (vNodes.length === 0) {
      if (rootNode.childNodes.length > 0) {
        rootNode.innerHTML = "";
      }
      return;
    }

    const nodes = [...rootNode.childNodes];

    const leftOverElements = nodes.length - vNodes.length;
    for (let i = leftOverElements; i > 0; i--) {
      rootNode.removeChild(nodes[nodes.length - i]);
    }

    for (const i in vNodes) {
      const vNode = vNodes[i];
      const vNodeType = getVNodeType(vNode);
      let node = nodes[i];

      if (!node) {
        node = createNode(vNode);
        rootNode.appendChild(node);
      } else if (vNodeType !== getNodeType(node)) {
        const newNode = createNode(vNode);
        rootNode.replaceChild(newNode, node);
        node = newNode;
      }

      if (vNodeType === "text") {
        if (node.textContent !== vNode) {
          node.textContent = vNode;
        }
        continue;
      }

      const vNodeAttributeNames = Object.keys(vNode.attributes);
      const nodeAttributeNames = node.getAttributeNames();
      for (const attr of nodeAttributeNames) {
        if (!vNodeAttributeNames.includes(attr)) {
          node.removeAttribute(attr);
        }
      }
      for (const attr of vNodeAttributeNames) {
        node.setAttribute(attr, vNode.attributes[attr]);
      }

      for (const key in vNode.properties) {
        if (node[key] !== vNode.properties[key]) {
          node[key] = vNode.properties[key];
        }
      }

      if (node instanceof PoringElement) {
        continue;
      }

      patchNode(node, vNode.children);
    }
  }

  function createNode(vNode) {
    return typeof vNode === "string"
      ? document.createTextNode(vNode)
      : document.createElement(vNode.tag);
  }

  function getNodeType(node) {
    if (node.nodeType === 3) return "text";
    if (node.nodeType === 8) return "comment";
    return node.tagName.toLowerCase();
  }

  class PoringElement extends HTMLElement {}

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
        this.scope = runScope({ component: this }, () => {
          this.attributeSignals = Object.fromEntries(
            attributes.map((attr) => [attr, useSignal(this.getAttribute(attr))])
          );
          logic(this.attributeSignals, this);
        });
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
    useBaseRenderer((c) => patchNode(c, normalizeVNodes(cb())));
  }

  // #endregion

  return {
    runScope,
    trackSignals,
    useSignal,
    useEffect,
    useComputed,
    component,
    h,
    useBaseRenderer,
    useRenderer,
    patchNode,
  };
})();
