'use strict';

class HeaderComponent extends Component {
    render() {
        return h('h1', {}, [
            h('a', { href: '#' }, "Servitor")
        ]);
    }
}

class JobListViewComponent extends Component {
    constructor() {
        super()
        this.jobs = [];
        this.fetchJobs();
    }

    async fetchJobs() {
        this.jobs = await fetch('/api/jobs/get_list').then(r => r.json());
        this.refresh();
    }

    render() {
        return h('ul', {}, this.jobs.map(j =>
            h('li', {}, [
                h('a', { href: `#job?job_id=${j.job_id}` }, j.job_id)
            ])
        ));
    }
}

class JobViewComponent extends Component {
    constructor() {
        super();
        this.job_executions = [];
        this.fetchJobInfo();
        this.onClickRun = this.onClickRun.bind(this);
    }

    getJobId() {
        return getInternalUrl().searchParams.get('job_id');
    }

    async fetchJobInfo() {
        this.job_executions = await fetch('/api/jobs/executions/get_list?job_id=' + this.getJobId())
            .then(r => r.json());
        this.refresh();
    }

    async onClickRun() {
        await fetch('/api/jobs/run?job_id=' + this.getJobId(), { method: 'POST' })
        await this.fetchJobInfo()
        this.refresh();
    }

    render() {
        return h('div', {}, [
            h('h3', {}, `Job: ${this.getJobId()}`),
            h('button', { type: 'button', onclick: this.onClickRun }, 'Run'),
            h('h4', {}, 'Executions'),
            h('ul', {}, this.job_executions.map(e =>
                h('li', {}, [
                    h('a', { href: `#job_execution?job_id=${this.getJobId()}&execution_id=${e.execution_id}` }, `${e.execution_id} [${e.status}]`)
                ])
            ))
        ])
    }
}

class JobExecutionViewComponent extends Component {
    constructor() {
        super();
        this.job_execution = null;
        this.job_execution_log = '';
        this.fetchJobExecutionInfo();
    }

    async fetchJobExecutionInfo() {
        this.job_execution = await fetch(`/api/jobs/executions/get?job_id=${this.getJobId()}&execution_id=${this.getExecutionId()}`)
            .then(r => r.json());
        this.refresh()
        this.job_execution_log = await fetch(`/api/jobs/executions/logs/get?job_id=${this.getJobId()}&execution_id=${this.getExecutionId()}`)
            .then(r => r.text());
        this.refresh()
    }

    getJobId() {
        return getInternalUrl().searchParams.get('job_id');
    }

    getExecutionId() {
        return getInternalUrl().searchParams.get('execution_id');
    }

    getExecutionStatusText() {
        if (this.job_execution == null) {
            return ''
        }
        return `[${this.job_execution.status}]`;
    }

    render() {
        return h('div', {}, [
            h('h3', {}, [
                h('a', { href: `#job?job_id=${this.getJobId()}` }, `Job: ${this.getJobId()}`)
            ]),
            h('h4', {}, `Execution: ${this.getExecutionId()} ${this.getExecutionStatusText()}`),
            h('pre', {}, this.job_execution_log)
        ])
    }
}

const ROUTES = [
    [/^$/, JobListViewComponent],
    [/^job$/, JobViewComponent],
    [/^job_execution$/, JobExecutionViewComponent],
]

class RouterComponent extends Component {
    constructor() {
        super();
        this.onHashChange = this.onHashChange.bind(this);
    }

    render() {
        return h(this.getActiveView())
    }

    getActiveView() {
        const path = getInternalUrl().pathname;
        for (const route of ROUTES) {
            const [matcher, component] = route;
            if (matcher.test(path)) {
                return getComponentTag(component);
            }
        }
        return hash;
    }

    onHashChange() {
        this.refresh();
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('hashchange', this.onHashChange);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('hashchange', this.onHashChange);
    }
}

registerComponent(HeaderComponent);
registerComponent(RouterComponent);
registerComponent(JobListViewComponent);
registerComponent(JobViewComponent);
registerComponent(JobExecutionViewComponent);
