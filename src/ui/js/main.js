class HeaderComponent extends Component {
    render() {
        return h('h1', {}, "Servitor");
    }
}

class JobListComponent extends Component {
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
                h('a', { href: '#' }, j.job_id)
            ])
        ));
    }
}

registerComponent(HeaderComponent);
registerComponent(JobListComponent);
