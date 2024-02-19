'use strict';

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

    const fetchJobExecutionInfo = async () => {
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

    const getExecutionStatus = () => {
        return jobExecution ? jobExecution.status : '';
    }
    const getExecutionStatusClass = () => {
        const status = getExecutionStatus()
        return status ? `is-${status}` : ''
    }

    fetchJobExecutionInfo();

    return () => (
        h('div', {}, [
            h('div', { class: `status-line ${getExecutionStatusClass()}` }, getExecutionStatus() || '...'),
            h('pre', {}, jobExecutionLog)
        ])
    )
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
