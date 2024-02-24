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

    function component(tag, logic) {
        class Component extends HTMLElement {

            constructor() {
                super();
            }

            refresh() {
                const renderResult = this.render();
                if (renderResult != null) {
                    this.replaceChildren(renderResult);
                } else {
                    this.innerHTML = '';
                }
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
                if (!this.logicResult) {
                    this.logicResult = logic(this);
                }
                this.refresh();
            }

            disconnectedCallback() {
                this.onDisconnected();
            }
        }
        customElements.define(tag, Component)
    }

    window.h = h;
    window.component = component;
})()

// #endregion

// #region Routing

function getInternalUrl() {
    const hash = document.location.hash.replace(/^#/, '');
    return new URL('internal:' + hash);
}

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

// #region Servitor Events

const ServitorEvents = (() => {
    const MINIMUM_TIME_BETWEEN_RETRIES_MILLIS = 4000;

    const eventListeners = [];

    function listen(cb) {
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
            return reader.read().then((result_1) => {
                if (!result_1.value) return;
                const msg = JSON.parse(decoder.decode(result_1.value));
                eventListeners.forEach(cb => cb(msg));
                return read();
            });
        }
        return read();
    }

    connectForever();

    return { listen }
})();

// #endregion

// #region Components

component('x-header', () => {
    const getJobId = () => getInternalUrl().searchParams.get('job_id');
    const getExecutionId = () => getInternalUrl().searchParams.get('execution_id');

    const getBreadcrumbs = () => {
        const jobId = getJobId();
        const executionId = getExecutionId();
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
    }

    return () => (
        h('div', {}, [
            h('h1', {}, [
                h('a', { href: '#' }, "servitor"),
            ]),
            ...getBreadcrumbs().map(([text, link]) => (
                h('div', { class: 'breadcrumb' }, [
                    link ? h('a', { href: link }, text) : h('span', {}, text)
                ])
            ))
        ])
    )
})

component('x-job-list', (c) => {
    let jobs = [];
    const fetchJobs = async () => {
        jobs = await fetch('/api/jobs/get_list').then(r => r.json());
        c.refresh();
    }
    fetchJobs();

    return () => (
        h('div', {}, [
            h('div', { class: 'x-section' }, [
                h('b', {}, 'jobs')
            ]),
            table(null, jobs.map(j => [
                h('a', { href: `#job?job_id=${j.job_id}` }, j.job_id)
            ]))
        ])
    )
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
    let jobExecutions = [];

    const getJobId = () => getInternalUrl().searchParams.get('job_id');

    const fetchJobInfo = async () => {
        jobExecutions = await fetch('/api/jobs/executions/get_list?job_id=' + getJobId())
            .then(r => r.json());
        c.refresh();
    }

    const onClickRun = async () => {
        await fetch('/api/jobs/run?job_id=' + getJobId(), { method: 'POST' })
        await fetchJobInfo()
        c.refresh();
    }

    fetchJobInfo();

    return () => (
        h('div', {}, [
            h('div', { class: 'x-section' }, [
                h('b', {}, 'executions'),
                h('button', { type: 'button', style: "margin-left: 1em;", onclick: onClickRun }, 'run'),
            ]),
            table([
                h('b', {}, '#'),
                'status',
            ], jobExecutions.map(e => [
                h('a', { href: `#job_execution?job_id=${getJobId()}&execution_id=${e.execution_id}` }, e.execution_id),
                e.status
            ])),
        ])
    )
})

component('x-job-execution', (c) => {
    const getJobId = () => getInternalUrl().searchParams.get('job_id');
    const getExecutionId = () => getInternalUrl().searchParams.get('execution_id');

    return {
        render: () => (
            h('div', {}, [
                h('x-job-execution-status-line', { 'job-id': getJobId(), 'execution-id': getExecutionId() }),
                h('x-job-execution-top-bar', { 'job-id': getJobId(), 'execution-id': getExecutionId() }),
                h('x-job-execution-logs', { 'job-id': getJobId(), 'execution-id': getExecutionId() })
            ])
        )
    }
})

component('x-job-execution-status-line', (c) => {
    const jobId = c.getAttribute('job-id');
    const executionId = c.getAttribute('execution-id');

    let jobExecution = null;

    const fetchJobExecutionInfo = () => {
        fetch(`/api/jobs/executions/get?job_id=${jobId}&execution_id=${executionId}`)
            .then(r => r.json())
            .then(result => {
                jobExecution = result
                c.refresh()
            })
    }

    const getExecutionStatus = () => {
        return jobExecution ? jobExecution.status : '';
    }
    const getExecutionStatusClass = () => {
        const status = getExecutionStatus()
        return status ? `is-${status}` : ''
    }

    const stopListeningEvents = ServitorEvents.listen((e) => {
        if (
            e.id === "job_execution_status_changed"
            && e.payload.job_id === jobId
            && e.payload.execution_id === executionId) {
            fetchJobExecutionInfo();
        }
    })

    fetchJobExecutionInfo();
    return {
        onDisconnected: () => {
            stopListeningEvents();
        },
        render: () => (
            h('div', { class: `status-line ${getExecutionStatusClass()}` }, getExecutionStatus() || '...')
        )
    }
})

component('x-job-execution-top-bar', (c) => {
    const jobId = c.getAttribute('job-id');
    const executionId = c.getAttribute('execution-id');

    let jobExecution = null;

    const cancelJobExecution = async () => {
        await fetch(`/api/jobs/executions/cancel?job_id=${getJobId()}&execution_id=${getExecutionId()}`, { method: 'POST' })
    }

    const fetchJobExecutionInfo = () => {
        fetch(`/api/jobs/executions/get?job_id=${jobId}&execution_id=${executionId}`)
            .then(r => r.json())
            .then(result => {
                jobExecution = result
                c.refresh()
            })
    }

    const getExecutionStatus = () => {
        return jobExecution ? jobExecution.status : '';
    }

    const stopListeningEvents = ServitorEvents.listen((e) => {
        if (
            e.id === "job_execution_status_changed"
            && e.payload.job_id === jobId
            && e.payload.execution_id === executionId) {
            fetchJobExecutionInfo();
        }
    })

    fetchJobExecutionInfo();
    return {
        onDisconnected: () => {
            stopListeningEvents();
        },
        render: () => (
            getExecutionStatus() === 'running'
                ? h('div', { class: 'x-section' }, [
                    h('button', { type: 'button', onclick: cancelJobExecution }, 'cancel')
                ])
                : null
        )
    }
})

component('x-job-execution-logs', (c) => {
    const jobId = c.getAttribute('job-id');
    const executionId = c.getAttribute('execution-id');
    let log = '';

    const fetchController = new AbortController();

    async function fetchLog() {
        try {
            await Networking.fetchChunks(
                `/api/jobs/executions/logs/get?job_id=${jobId}&execution_id=${executionId}`,
                fetchController,
                (chunk) => {
                    log += chunk;
                    c.refresh();
                }
            )
        } catch (err) { }
    }
    fetchLog();

    return {
        onDisconnected: () => {
            fetchController.abort()
        },
        render: () => (
            h('pre', {}, log)
        )
    }
})

const ROUTES = [
    [/^$/, 'x-job-list'],
    [/^job$/, 'x-job'],
    [/^job_execution$/, 'x-job-execution'],
]

component('x-root', (c) => {
    const onHashChange = () => { c.refresh() }
    window.addEventListener('hashchange', onHashChange);

    const getActivePage = () => {
        const path = getInternalUrl().pathname;
        for (const route of ROUTES) {
            const [matcher, component] = route;
            if (matcher.test(path)) {
                return h(component)
            }
        }
    }

    return {
        onDisconnected: () => {
            window.removeEventListener('hashchange', onHashChange);
        },
        render: () => (
            h('div', {}, [
                h('x-header'),
                getActivePage()
            ])
        )
    }
})

// #endregion
