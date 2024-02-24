'use strict';

// #region Rendering

(() => {
    const EVENT_LISTENER_ATTRIBUTES = ["onclick"]

    function h(tag, _props, _children) {
        const props = _props || {};
        const children = normalizeChildren(_children);

        const el = document.createElement(tag);

        for (const key in props) {
            if (EVENT_LISTENER_ATTRIBUTES.indexOf(key) >= 0) {
                el.addEventListener(key.substring(2), props[key]);
            } else {
                el.setAttribute(key, props[key]);
            }
        }

        for (const _child of children) {
            const child = typeof _child === 'string'
                ? document.createTextNode(_child)
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

    const renderingState = {
        currentComponent: null,
        hookCounter: 0
    };

    function useEffect(cb, busters) {
        if (renderingState.currentComponent == null) {
            throw new Error("Hook used outside of element")
        }
        if (renderingState.currentComponent.__hookState[renderingState.hookCounter] == null) {
            renderingState.currentComponent.__hookState[renderingState.hookCounter] = { firstRun: false }
        }
        const state = renderingState.currentComponent.__hookState[renderingState.hookCounter];
        if (!state.firstRun || !bustersAreEqual(state.busters, busters)) {
            state.firstRun = true;
            state.busters = busters;
            if (state.cleanup != null) {
                state.cleanup();
            }
            state.cleanup = cb();
        }
        renderingState.hookCounter++;
    }

    function useState(initialValue) {
        if (renderingState.currentComponent == null) {
            throw new Error("Hook used outside of element")
        }
        if (renderingState.currentComponent.__hookState[renderingState.hookCounter] == null) {
            renderingState.currentComponent.__hookState[renderingState.hookCounter] = {
                component: renderingState.currentComponent,
                value: initialValue
            }
        }
        const state = renderingState.currentComponent.__hookState[renderingState.hookCounter];
        if (state.setter == null) {
            state.setter = (_param) => {
                const newValue = typeof _param === "function"
                    ? _param(state.value)
                    : _param;
                state.value = newValue;
                if (renderingState.currentComponent == null) {
                    state.component.refresh();
                }
            }
        }
        renderingState.hookCounter++;
        return [state.value, state.setter];
    }

    function useCallback(cb, busters) {
        const [storedCb, setStoredCb] = useState(cb);
        useEffect(() => {
            setStoredCb(() => cb)
        }, busters)
        return storedCb;
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

    function component(tag, logic) {
        class Component extends HTMLElement {

            constructor() {
                super();
            }

            refresh() {
                const renderResult = this.render();
                if (renderResult != null) {
                    this.replaceChildren(...(Array.isArray(renderResult) ? renderResult : [renderResult]));
                } else {
                    this.innerHTML = '';
                }
            }

            render() {
                if (this.__hookState == null) {
                    this.__hookState = [];
                }
                renderingState.currentComponent = this;
                let result;
                try {
                    result = logic(this);
                } catch (err) { }
                renderingState.currentComponent = null;
                renderingState.hookCounter = 0;
                return result;
            }

            connectedCallback() {
                this.refresh();
            }

            disconnectedCallback() {
                for (const hookState of (this.__hookState || [])) {
                    if (hookState.cleanup != null) {
                        hookState.cleanup();
                    }
                }
            }
        }
        customElements.define(tag, Component)
    }

    window.h = h;
    window.component = component;
    window.useEffect = useEffect;
    window.useState = useState;
    window.useCallback = useCallback;
})();

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
    const MINIMUM_TIME_BETWEEN_RETRIES_MILLIS = 4000;

    const eventListeners = [];

    function listenEvents(cb) {
        eventListeners.push(cb);
        return () => {
            const pos = eventListeners.indexOf(cb);
            eventListeners.splice(pos, 1);
        }
    }

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
                const msg = JSON.parse(decoder.decode(result.value));
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
        const [log, setLog] = useState('')
        useEffect(() => {
            const fetchController = new AbortController();
            async function fetchLog() {
                try {
                    await Networking.fetchChunks(
                        `/api/jobs/executions/logs/get?job_id=${jobId}&execution_id=${executionId}`,
                        fetchController,
                        (chunk) => {
                            setLog(l => l + chunk);
                        }
                    )
                } catch (err) { }
            }
            fetchLog();
            return () => fetchController.abort();
        }, [jobId, executionId])
        return log;
    }

    return { listenEvents, useJobs, useJobExecutions, useJobExecution, useJobExecutionLog }
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

component('x-job-list', (c) => {
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

component('x-job', (c) => {
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
            'status',
        ], jobExecutions.map(e => [
            h('a', { href: `#job_execution?job_id=${jobId}&execution_id=${e.execution_id}` }, e.execution_id),
            e.status
        ])),
    ])
})

component('x-job-execution', () => {
    const internalUrl = useInternalUrl()
    const jobId = internalUrl.searchParams.get('job_id');
    const executionId = internalUrl.searchParams.get('execution_id');

    return h('div', {}, [
        h('x-job-execution-status-line', { 'job-id': jobId, 'execution-id': executionId }),
        h('x-job-execution-top-bar', { 'job-id': jobId, 'execution-id': executionId }),
        h('x-job-execution-logs', { 'job-id': jobId, 'execution-id': executionId })
    ])
})

component('x-job-execution-status-line', (c) => {
    const jobId = c.getAttribute('job-id');
    const executionId = c.getAttribute('execution-id');

    const [jobExecution] = useJobExecution(jobId, executionId);
    const jobExecutionStatus = jobExecution != null ? jobExecution.status : '';
    const jobExecutionStatusClass = jobExecutionStatus ? `is-${jobExecutionStatus}` : ''

    return h('div', { class: `status-line ${jobExecutionStatusClass}` }, jobExecutionStatus || '...');
})

component('x-job-execution-top-bar', (c) => {
    const jobId = c.getAttribute('job-id');
    const executionId = c.getAttribute('execution-id');

    const [jobExecution] = useJobExecution(jobId, executionId);
    const jobExecutionStatus = jobExecution != null ? jobExecution.status : '';

    const cancelJobExecution = async () => {
        await fetch(`/api/jobs/executions/cancel?job_id=${jobId}&execution_id=${executionId}`, { method: 'POST' })
    }

    return jobExecutionStatus === 'running'
        ? h('div', { class: 'x-section' }, [
            h('button', { type: 'button', onclick: cancelJobExecution }, 'cancel')
        ])
        : null
})

component('x-job-execution-logs', (c) => {
    const jobId = c.getAttribute('job-id');
    const executionId = c.getAttribute('execution-id');
    const log = useJobExecutionLog(jobId, executionId);
    return h('pre', {}, log);
})

const ROUTES = [
    [/^$/, 'x-job-list'],
    [/^job$/, 'x-job'],
    [/^job_execution$/, 'x-job-execution'],
]

component('x-root', (c) => {
    const internalUrl = useInternalUrl();
    const activePage = (() => {
        for (const route of ROUTES) {
            const [matcher, component] = route;
            if (matcher.test(internalUrl.pathname)) {
                return h(component)
            }
        }
    })()

    return h('div', {}, [
        h('x-header'),
        activePage
    ])
})

// #endregion
