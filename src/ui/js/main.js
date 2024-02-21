'use strict';

// #region Rendering

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
            this.logicResult = logic(this);
        }

        refresh() {
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
            this.refresh();
        }

        disconnectedCallback() {
            this.onDisconnected();
        }
    }
    customElements.define(tag, Component)
}

// #endregion

// #region Routing

function getInternalUrl() {
    const hash = document.location.hash.replace(/^#/, '');
    return new URL('internal:' + hash);
}

// #endregion

// #region Servitor Events

const ServitorEvents = (() => {
    const eventListeners = [];

    function listen(cb) {
        eventListeners.push(cb);
        return () => {
            const pos = eventListeners.indexOf(cb);
            eventListeners.splice(pos, 1);
        }
    }

    fetch('/api/events')
        .then((response) => {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            function read() {
                return reader.read().then((result) => {
                    if (!result.value) return;
                    const msg = JSON.parse(decoder.decode(result.value));
                    eventListeners.forEach(cb => cb(msg));
                    return read();
                })
            }

            return read();
        });

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
        h('ul', {}, jobs.map(j =>
            h('li', {}, [
                h('a', { href: `#job?job_id=${j.job_id}` }, j.job_id)
            ])
        ))
    )
})

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
            h('p', {}, [
                h('button', { type: 'button', onclick: onClickRun }, 'Run'),
            ]),
            h('h4', {}, 'Executions'),
            h('ul', {}, jobExecutions.map(e =>
                h('li', {}, [
                    h('a', { href: `#job_execution?job_id=${getJobId()}&execution_id=${e.execution_id}` }, `${e.execution_id} [${e.status}]`)
                ])
            ))
        ])
    )
})

component('x-job-execution', (c) => {
    let jobExecution = null;
    let jobExecutionLog = '';

    const getJobId = () => getInternalUrl().searchParams.get('job_id');
    const getExecutionId = () => getInternalUrl().searchParams.get('execution_id');

    const fetchJobExecutionInfo = () => {
        fetch(`/api/jobs/executions/get?job_id=${getJobId()}&execution_id=${getExecutionId()}`)
            .then(r => r.json())
            .then(result => {
                jobExecution = result
                c.refresh()
            })

        fetch(`/api/jobs/executions/logs/get?job_id=${getJobId()}&execution_id=${getExecutionId()}`)
            .then(r => r.text())
            .then(result => {
                jobExecutionLog = result
                c.refresh()
            })
    }

    const cancelJobExecution = async () => {
        await fetch(`/api/jobs/executions/cancel?job_id=${getJobId()}&execution_id=${getExecutionId()}`, { method: 'POST' })
    }

    const getExecutionStatus = () => {
        return jobExecution ? jobExecution.status : '';
    }
    const getExecutionStatusClass = () => {
        const status = getExecutionStatus()
        return status ? `is-${status}` : ''
    }

    fetchJobExecutionInfo();

    let refreshInterval = getExecutionStatus() === "running" || getExecutionStatus() === "" ? setInterval(() => {
        if (getExecutionStatus() !== "running") {
            clearInterval(refreshInterval);
            refreshInterval = null;
            return;
        }
        fetchJobExecutionInfo();
    }, 2000) : null;

    const stopListeningEvents = ServitorEvents.listen((e) => {
        if (
            e.id === "job_execution_status_changed"
            && e.payload.job_id === getJobId()
            && e.payload.execution_id === getExecutionId()) {
            fetchJobExecutionInfo();
        }
    })

    return {
        onDisconnected: () => {
            if (refreshInterval != null) { clearInterval(refreshInterval); }
            stopListeningEvents();
        },
        render: () => (
            h('div', {}, [
                h('div', { class: `status-line ${getExecutionStatusClass()}` }, getExecutionStatus() || '...'),
                ...(getExecutionStatus() === 'running' ? [
                    h('p', {}, [
                        h('button', { type: 'button', onclick: cancelJobExecution }, 'cancel')
                    ])
                ] : []),
                h('pre', {}, jobExecutionLog)
            ])
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
