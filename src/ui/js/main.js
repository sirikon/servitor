'use strict';

// #region Hooks

const Hooks = (() => {

    const context = {
        component: null,
        states: null,
        hookCounter: 0
    };

    function withComponent(component, states, cb) {
        if (component.__hookState == null) {
            component.__hookState = [];
        }
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

    return { withComponent, useEffect, usePostRenderEffect, useCustomDomPatcher, useState, useRef, useCallback }
})();
const useEffect = Hooks.useEffect;
const usePostRenderEffect = Hooks.usePostRenderEffect;
const useCustomDomPatcher = Hooks.useCustomDomPatcher;
const useState = Hooks.useState;
const useRef = Hooks.useRef;
const useCallback = Hooks.useCallback;

// #endregion

// #region Rendering

const Rendering = (() => {
    const EVENT_LISTENER_ATTRIBUTES = ["onclick"]

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


    return { h, component, patchDom }
})();
const h = Rendering.h;
const component = Rendering.component;

// #endregion

// #region Routing

const Routing = (() => {
    function getInternalUrl() {
        const hash = document.location.hash.replace(/^#/, '');
        return new URL('internal:' + hash);
    }

    function useInternalUrl() {
        const [internalUrl, setInternalUrl] = useState(getInternalUrl());
        useEffect(() => {
            const onHashChange = () => { setInternalUrl(getInternalUrl()) }
            window.addEventListener('hashchange', onHashChange);
            return () => window.removeEventListener('hashchange', onHashChange);
        }, [])
        return internalUrl;
    }

    return {
        useInternalUrl
    }
})();
const useInternalUrl = Routing.useInternalUrl;

// #endregion

// #region Networking

const Networking = (() => {

    async function fetchChunks(url, controller, onchunk) {
        const response = await fetch(url, { signal: controller.signal });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        function read() {
            return reader.read().then((result) => {
                if (!result.value) return;
                const chunk = decoder.decode(result.value);
                onchunk(chunk)
                return read();
            });
        }
        return read();
    }

    return { fetchChunks }
})()

// #endregion

// #region Data

const Data = (() => {

    const Events = (() => {
        const eventListeners = [];

        function listenEvents(cb) {
            eventListeners.push(cb);
            return () => {
                const pos = eventListeners.indexOf(cb);
                eventListeners.splice(pos, 1);
            }
        }

        const MINIMUM_TIME_BETWEEN_RETRIES_MILLIS = 4000;

        async function connectForever() {
            while (true) {
                const startTimestamp = Date.now();
                try {
                    await fetchEventsForever();
                } catch (err) {
                    console.debug(err);
                }
                const millisToWait = Math.max((startTimestamp + MINIMUM_TIME_BETWEEN_RETRIES_MILLIS) - Date.now(), 0);
                await waitMillis(millisToWait);
            }
        }

        async function waitMillis(ms) {
            return new Promise((resolve) => setTimeout(() => resolve(null), ms))
        }

        async function fetchEventsForever() {
            const controller = new AbortController();
            const response = await fetch('/api/events', { signal: controller.signal });
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            function read() {
                return reader.read().then((result) => {
                    if (!result.value) return;
                    let msg;
                    try {
                        msg = JSON.parse(decoder.decode(result.value));
                    } catch (err) {
                        console.debug("Error while parsing event", result.value);
                        return read();
                    }
                    eventListeners.slice(0).forEach(cb => cb(msg));
                    return read();
                });
            }
            return read();
        }

        connectForever();

        function useEvents(cb) {
            useEffect(() => {
                const stop = listenEvents(cb);
                return () => stop();
            }, [cb])
        }

        return { useEvents }
    })()
    const useEvents = Events.useEvents;

    function useFetch(url, initialValue) {
        const [iter, setIter] = useState(0);
        const [result, setResult] = useState(initialValue);

        const refresh = useCallback(() => {
            setIter(v => v + 1)
        }, [setIter]);

        useEffect(() => {
            const controller = new AbortController();
            fetch(url)
                .then(r => r.json())
                .then(d => setResult(d));
            return () => controller.abort();
        }, [url, iter])
        return [result, refresh];
    }

    function useJobs() {
        return useFetch('/api/jobs/get_list', []);
    }

    function useJobExecutions(jobId) {
        const [jobExecutions, refreshJobExecutions] = useFetch('/api/jobs/executions/get_list?job_id=' + jobId, []);
        const eventCallback = useCallback((e) => {
            if (
                e.id === "job_execution_status_changed"
                && e.payload.job_id === jobId) {
                refreshJobExecutions()
            }
        }, [jobId, refreshJobExecutions])
        useEvents(eventCallback);
        return [jobExecutions, refreshJobExecutions];
    }

    function useJobExecution(jobId, executionId) {
        const [jobExecution, refreshJobExecution] = useFetch(`/api/jobs/executions/get?job_id=${jobId}&execution_id=${executionId}`, null);
        const cb = (e) => {
            if (
                e.id === "job_execution_status_changed"
                && e.payload.job_id === jobId
                && e.payload.execution_id === executionId) {
                refreshJobExecution()
            }
        }
        const eventCallback = useCallback(cb, [jobId, executionId, refreshJobExecution])
        useEvents(eventCallback);
        return [jobExecution, refreshJobExecution];
    }

    function useJobExecutionLog(jobId, executionId) {
        const [_, setTick] = useState(true);
        const log = useRef({ reset: true, chunks: [] });
        useEffect(() => {
            log.current.reset = true;
            log.current.chunks.splice(0, log.current.chunks.length);
            const fetchController = new AbortController();
            async function fetchLog() {
                try {
                    await Networking.fetchChunks(
                        `/api/jobs/executions/logs/get?job_id=${jobId}&execution_id=${executionId}`,
                        fetchController,
                        (chunk) => {
                            log.current.chunks.push(chunk);
                            setTick(v => !v);
                        }
                    )
                } catch (err) { }
            }
            fetchLog();
            return () => fetchController.abort();
        }, [jobId, executionId])
        return log;
    }

    return { useJobs, useJobExecutions, useJobExecution, useJobExecutionLog }
})();
const useJobs = Data.useJobs;
const useJobExecutions = Data.useJobExecutions;
const useJobExecution = Data.useJobExecution;
const useJobExecutionLog = Data.useJobExecutionLog;

// #endregion

// #region Components

component('x-header', () => {
    const internalUrl = useInternalUrl();
    const jobId = internalUrl.searchParams.get('job_id');
    const executionId = internalUrl.searchParams.get('execution_id');
    const breadcrumbs = (() => {
        if (executionId) {
            return [
                [jobId, `#job?job_id=${jobId}`],
                [`#${executionId}`, null]
            ]
        }
        if (jobId) {
            return [
                [jobId, null]
            ]
        }
        return []
    })()

    return h('div', {}, [
        h('h1', {}, [
            h('a', { href: '#' }, "servitor"),
        ]),
        ...breadcrumbs.map(([text, link]) => (
            h('div', { class: 'breadcrumb' }, [
                link ? h('a', { href: link }, text) : h('span', {}, text)
            ])
        ))
    ])
})

component('x-job-list', () => {
    const [jobs] = useJobs();

    return h('div', {}, [
        h('div', { class: 'x-section' }, [
            h('b', {}, 'jobs')
        ]),
        table(null, jobs.map(j => [
            h('a', { href: `#job?job_id=${j.job_id}` }, j.job_id)
        ]))
    ])
})

component('x-job', () => {
    const internalUrl = useInternalUrl()
    const jobId = internalUrl.searchParams.get('job_id');
    const [jobExecutions] = useJobExecutions(jobId);

    const onClickRun = async () => {
        await fetch('/api/jobs/run?job_id=' + jobId, { method: 'POST' });
    }

    return h('div', {}, [
        h('div', { class: 'x-section' }, [
            h('b', {}, 'executions'),
            h('button', { type: 'button', style: "margin-left: 1em;", onclick: onClickRun }, 'run'),
        ]),
        table([
            h('b', {}, '#'),
            '',
            'status',
            'started',
            'duration',
        ], jobExecutions.map(e => [
            h('a', { href: `#job_execution?job_id=${jobId}&execution_id=${e.execution_id}` }, e.execution_id),
            h('div', {}, [
                h('div', { class: `status-circle is-${e.status}` }),
            ]),
            h('div', {}, [
                h('span', {}, e.status)
            ]),
            h('div', {}, [
                h('span', {}, formatTimestamp(e.status_history.find(i => i.status === "running")?.timestamp))
            ]),
            h('div', {},
                (() => {
                    const start = e.status_history.find(i => i.status === "running");
                    if (start == null) return '';
                    if (!["success", "failure", "cancelled"].includes(e.status)) {
                        return h('x-duration-clock', { "start-timestamp": start.timestamp });
                    }
                    const end = e.status_history.find(i => i.status === e.status);
                    return h('x-duration-clock', { "start-timestamp": start.timestamp, "end-timestamp": end?.timestamp || '' });
                })()
            ),
        ])),
    ])
})

component('x-job-execution', () => {
    const internalUrl = useInternalUrl()
    const jobId = internalUrl.searchParams.get('job_id');
    const executionId = internalUrl.searchParams.get('execution_id');

    const [jobExecution] = useJobExecution(jobId, executionId);

    const cancelJobExecution = useCallback(() => {
        fetch(`/api/jobs/executions/cancel?job_id=${jobId}&execution_id=${executionId}`, { method: 'POST' })
    }, [jobId, executionId])

    const startTimestamp = (jobExecution?.status_history || []).find(i => i.status === "running")?.timestamp || null
    const endTimestamp = ["success", "failure", "cancelled"].includes(jobExecution?.status)
        ? jobExecution.status_history.find(i => i.status === jobExecution.status)?.timestamp || null
        : null

    const [follow, setFollow] = useState(false);

    return h('div', {}, [
        h('div', { class: `status-line is-${jobExecution?.status || ''}` }, jobExecution?.status || '...'),
        h('div', { class: 'top-bar x-box' }, [
            h('p', {}, [
                startTimestamp && h('span', { class: 'x-kv-key' }, 'started'),
                startTimestamp && h('span', {}, formatTimestamp(startTimestamp)),

                startTimestamp && h('span', { class: 'x-kv-sep' }),
                startTimestamp && h('span', { class: 'x-kv-key' }, 'duration'),
                startTimestamp && h('x-duration-clock', { "start-timestamp": startTimestamp, "end-timestamp": endTimestamp || '' }),

                startTimestamp && h('span', { class: 'x-kv-sep' }),
                jobExecution?.status === "running" && h('button', { type: 'button', onclick: cancelJobExecution }, 'cancel')
            ])
        ]),
        h('x-job-execution-logs', { 'job-id': jobId, 'execution-id': executionId, 'follow-logs': follow.toString() }),
        h('div', { class: `x-box follow-logs-box ${jobExecution?.status === "running" ? 'is-sticky' : ''}` }, [
            h('p', {}, [
                jobExecution?.status === "running" && h('button',
                    { type: "button", onclick: () => setFollow(f => !f) },
                    follow ? "stop following logs" : "follow logs"),

                jobExecution?.result && h('span', { class: 'x-kv-key' }, 'exit code'),
                jobExecution?.result && h('span', {}, jobExecution.result.exit_code),

                jobExecution?.result?.message && h('span', { class: 'x-kv-sep' }),
                jobExecution?.result?.message && h('span', { class: 'x-kv-key' }, 'message'),
                jobExecution?.result?.message && h('span', {}, jobExecution.result.message)
            ])
        ])
    ])
})

component('x-job-execution-logs', ['job-id', 'execution-id', 'follow-logs'], (attrs) => {
    const jobId = attrs['job-id'];
    const executionId = attrs['execution-id'];
    const followLogs = attrs['follow-logs'] === "true";
    const log = useJobExecutionLog(jobId, executionId);

    usePostRenderEffect(() => {
        if (followLogs) {
            window.document.documentElement.scrollTop = window.document.documentElement.scrollHeight;
        }
    });

    useCustomDomPatcher((el) => {
        let pre = el.querySelector('pre');
        if (pre == null) {
            pre = h('pre', {});
            el.appendChild(pre);
        }
        if (log.current.reset) {
            pre.textContent = '';
            log.current.reset = false;
        }
        for (const chunk of log.current.chunks) {
            pre.appendChild(document.createTextNode(chunk));
        }
        log.current.chunks.splice(0, log.current.chunks.length);
    });
})

component('x-duration-clock', ["start-timestamp", "end-timestamp"], (attrs) => {
    const startTimestamp = attrs["start-timestamp"];
    const endTimestamp = attrs["end-timestamp"];
    const startDate = new Date(startTimestamp)
    const endDate = !!endTimestamp ? new Date(endTimestamp) : new Date()

    const [_, setTick] = useState(true);
    useEffect(() => {
        if (endTimestamp) return;
        const interval = setInterval(() => {
            setTick(v => !v);
        }, 1000)
        return () => clearInterval(interval);
    }, [startTimestamp, endTimestamp])

    let duration = endDate - startDate;
    const minutes = Math.floor(duration / (60 * 1000))
    duration -= minutes * (60 * 1000);
    const seconds = Math.floor(duration / (1000))

    const result = [
        minutes.toString().padStart(2, '0'),
        seconds.toString().padStart(2, '0'),
    ].join(':')

    return h('span', {}, result);
})

function table(header, rows) {
    return h('div', { class: "x-table" },
        [
            ...(header != null && header.length > 0 ? [
                h('div', { class: "row header" }, header.map((item, i) => h('div', { class: "cell", "data-column": i }, [item])))
            ] : []),
            ...rows.map((items, i) => h('div', { class: "row", "data-row": i },
                items.map((item, i) => h('div', { class: 'cell', "data-column": i }, [item]))))
        ]
    )
}

function formatTimestamp(timestamp) {
    if (timestamp == null) return '';
    const date = new Date(timestamp);
    return [
        [
            date.getFullYear(),
            (date.getMonth() + 1).toString().padStart(2, '0'),
            (date.getDate()).toString().padStart(2, '0'),
        ].join('-'),
        [
            date.getHours().toString().padStart(2, '0'),
            date.getMinutes().toString().padStart(2, '0'),
            date.getSeconds().toString().padStart(2, '0')
        ].join(':')
    ].join(' ');
}

const ROUTES = [
    [/^$/, 'x-job-list'],
    [/^job$/, 'x-job'],
    [/^job_execution$/, 'x-job-execution'],
]

component('x-router', () => {
    const internalUrl = useInternalUrl();
    for (const route of ROUTES) {
        const [matcher, component] = route;
        if (matcher.test(internalUrl.pathname)) {
            return h(component)
        }
    }
})

component('x-root', () => {
    return h('div', {}, [
        h('x-header'),
        h('x-router')
    ])
})

// #endregion
