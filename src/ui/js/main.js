'use strict';

const signal = poring.signal;
const effect = poring.effect;
const compute = poring.compute;
const component = poring.component;
const baseRenderer = poring.baseRenderer;
const renderer = poring.renderer;
const h = poring.h;

// #region Routing

function useInternalUrl() {
    const value = signal();
    effect(() => {
        function handler() {
            const hash = document.location.hash.replace(/^#/, '');
            value.set(new URL('internal:' + hash));
        }
        handler();
        window.addEventListener('hashchange', handler);
        return () => window.removeEventListener('hashchange', handler);
    })
    return {
        get: () => value.get()
    }
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

                    const newLinesPositions = result.value
                        .reduce((result, byte, pos) => {
                            if (byte === 10) {
                                result.push(pos);
                            }
                            return result;
                        }, []);

                    const events = [];
                    let startPos = 0;
                    for (const newLinePos of newLinesPositions) {
                        events.push(JSON.parse(decoder.decode(result.value.slice(startPos, newLinePos))));
                        startPos = newLinePos + 1;
                    }

                    for (const event of events) {
                        eventListeners.slice(0).forEach(cb => cb(event));
                    }

                    return read();
                });
            }
            return read();
        }

        connectForever();

        function useEvents(cb) {
            effect(() => {
                const stop = listenEvents(cb);
                return () => stop();
            })
        }

        return { useEvents }
    })()
    const useEvents = Events.useEvents;

    function useFetch(initialValue, cb) {
        const result = signal(initialValue)
        const e = effect(() => {
            const url = cb();
            const controller = new AbortController();
            fetch(url)
                .then(r => r.json())
                .then(d => result.set(d));
            return () => controller.abort();
        })
        return {
            get: () => result.get(),
            refresh: () => e.execute()
        }
    }

    function useJobs() {
        return useFetch([], () => '/api/jobs/get_list');
    }

    function useJob(jobIdCb) {
        return useFetch(null, () => '/api/jobs/get?job_id=' + jobIdCb());
    }

    function useJobExecutions(jobIdCb) {
        const jobExecutions = useFetch([], () => '/api/jobs/executions/get_list?job_id=' + jobIdCb())
        useEvents((e) => {
            if (
                e.id === "job_execution_status_changed"
                && e.payload.job_id === jobIdCb()) {
                jobExecutions.refresh();
            }
        })
        return { get: () => jobExecutions.get() }
    }

    function useJobExecution(cb) {
        const jobExecution = useFetch(null, () => {
            const { jobId, executionId } = cb();
            return `/api/jobs/executions/get?job_id=${jobId}&execution_id=${executionId}`
        })
        useEvents((e) => {
            const { jobId, executionId } = cb();
            if (
                e.id === "job_execution_status_changed"
                && e.payload.job_id === jobId
                && e.payload.execution_id === executionId) {
                jobExecution.refresh()
            }
        });
        return { get: () => jobExecution.get() }
    }

    function useJobExecutionLog(cb) {
        const log = {
            reset: true,
            chunks: []
        }
        const tick = signal(false);
        effect(() => {
            const { jobId, executionId } = cb();
            log.reset = true;
            log.chunks.splice(0, log.chunks.length);
            const fetchController = new AbortController();
            async function fetchLog() {
                try {
                    await Networking.fetchChunks(
                        `/api/jobs/executions/logs/get?job_id=${jobId}&execution_id=${executionId}`,
                        fetchController,
                        (chunk) => {
                            log.chunks.push(chunk);
                            tick.set(v => !v);
                        }
                    )
                } catch (err) { }
            }
            fetchLog();
            return () => fetchController.abort();
        })

        return { log, tick };
    }

    return { useJobs, useJob, useJobExecutions, useJobExecution, useJobExecutionLog }
})();
const useJobs = Data.useJobs;
const useJob = Data.useJob;
const useJobExecutions = Data.useJobExecutions;
const useJobExecution = Data.useJobExecution;
const useJobExecutionLog = Data.useJobExecutionLog;

// #endregion

// #region Components

component('x-header', [], () => {
    const internalUrl = useInternalUrl();

    const breadcrumbs = compute(() => {
        const jobId = internalUrl.get().searchParams.get('job_id');
        const executionId = internalUrl.get().searchParams.get('execution_id');

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
    })

    renderer(() =>
        h('div', {}, [
            h('h1', {}, [
                h('a', { href: '#' }, "servitor"),
            ]),
            ...breadcrumbs.get().map(([text, link]) => (
                h('div', { class: 'breadcrumb' }, [
                    link ? h('a', { href: link }, text) : h('span', {}, text)
                ])
            ))
        ])
    )
})

component('x-job-list', [], () => {
    const jobs = useJobs();

    renderer(() =>
        h('div', {}, [
            h('div', { class: 'x-section' }, [
                h('b', {}, 'jobs')
            ]),
            table(null, jobs.get().map(j => [
                h('a', { href: `#job?job_id=${j.job_id}` }, j.job_id)
            ]))
        ])
    )
})

component('x-job', [], () => {
    const internalUrl = useInternalUrl()
    const jobId = compute(() => internalUrl.get().searchParams.get('job_id'));
    const job = useJob(() => jobId.get());
    const jobExecutions = useJobExecutions(() => jobId.get());

    const inputValues = signal({});
    const inputCount = compute(() => Object.keys(job.get()?.input_spec || {}).length);

    const onClickRun = async () => {
        const inputValuesQueryParams = Object.keys(inputValues.get()).map(key => {
            return `&input_value_${key}=${encodeURIComponent(inputValues.get()[key])}`
        }).join('');
        await fetch(`/api/jobs/run?job_id=${jobId.get()}${inputValuesQueryParams}`, { method: 'POST' });
    }

    renderer(() =>
        h('div', {}, [
            job.get() != null && inputCount.get() > 0 && h('div', { class: 'x-section' }, [
                h('p', {}, [
                    ...Object.keys(job.get().input_spec).map((key) => {
                        return [
                            h('label', {}, `${key}: `),
                            h('input', {
                                type: "text",
                                oninput: (e) => inputValues.set((v) => ({ ...v, [key]: e.target.value }))
                            }),
                            h('br')
                        ]
                    }).flat(),
                ]),
                h('p', {}, [
                    h('button', { type: 'button', onclick: onClickRun }, 'run'),
                ])
            ]),
            h('div', { class: 'x-section' }, [
                h('b', {}, 'executions'),
                job.get() != null && inputCount.get() === 0 && h('button', { type: 'button', style: "margin-left: 1em;", onclick: onClickRun }, 'run'),
            ]),
            table([
                h('b', {}, '#'),
                '',
                'status',
                'started',
                'duration',
            ], jobExecutions.get().map(e => [
                h('a', { href: `#job_execution?job_id=${jobId.get()}&execution_id=${e.execution_id}` }, e.execution_id),
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
    )
})

component('x-job-execution', [], () => {
    const internalUrl = useInternalUrl()
    const jobId = compute(() => internalUrl.get().searchParams.get('job_id'));
    const executionId = compute(() => internalUrl.get().searchParams.get('execution_id'));

    const jobExecution = useJobExecution(() => ({
        jobId: jobId.get(),
        executionId: executionId.get()
    }));

    const cancelJobExecution = () => {
        fetch(`/api/jobs/executions/cancel?job_id=${jobId.get()}&execution_id=${executionId.get()}`, { method: 'POST' })
    };

    const startTimestamp = compute(() => (jobExecution.get()?.status_history || []).find(i => i.status === "running")?.timestamp || null);
    const endTimestamp = compute(() => ["success", "failure", "cancelled"].includes(jobExecution.get()?.status)
        ? jobExecution.get().status_history.find(i => i.status === jobExecution.get().status)?.timestamp || null
        : null)

    const follow = signal(false);

    renderer(() =>
        h('div', {}, [
            h('div', { class: `status-line is-${jobExecution.get()?.status || ''}` }, jobExecution.get()?.status || '...'),
            h('div', { class: 'top-bar x-box' }, [
                h('p', {}, [
                    startTimestamp.get() && h('span', { class: 'x-kv-key' }, 'started'),
                    startTimestamp.get() && h('span', {}, formatTimestamp(startTimestamp.get())),

                    startTimestamp.get() && h('span', { class: 'x-kv-sep' }),
                    startTimestamp.get() && h('span', { class: 'x-kv-key' }, 'duration'),
                    startTimestamp.get() && h('x-duration-clock', { "start-timestamp": startTimestamp.get(), "end-timestamp": endTimestamp.get() || '' }),

                    startTimestamp.get() && h('span', { class: 'x-kv-sep' }),
                    jobExecution.get()?.status === "running" && h('button', { type: 'button', onclick: cancelJobExecution }, 'cancel')
                ])
            ]),
            Object.keys(jobExecution.get()?.input_values || {}).length > 0
                ? table(null, Object.keys(jobExecution.get().input_values).map(key => {
                    return [key, jobExecution.get().input_values[key]]
                }))
                : h('div'),
            h('x-job-execution-logs', { 'job-id': jobId.get(), 'execution-id': executionId.get(), 'follow-logs': follow.get().toString() }),
            h('div', { class: `x-box follow-logs-box ${jobExecution.get()?.status === "running" ? 'is-sticky' : ''}` }, [
                h('p', {}, [
                    jobExecution.get()?.status === "running" && h('button',
                        { type: "button", onclick: () => follow.set(f => !f) },
                        follow.get() ? "stop following logs" : "follow logs"),

                    jobExecution.get()?.result && h('span', { class: 'x-kv-key' }, 'exit code'),
                    jobExecution.get()?.result && h('span', {}, jobExecution.get().result.exit_code),

                    jobExecution.get()?.result?.message && h('span', { class: 'x-kv-sep' }),
                    jobExecution.get()?.result?.message && h('span', { class: 'x-kv-key' }, 'message'),
                    jobExecution.get()?.result?.message && h('span', {}, jobExecution.get().result.message)
                ])
            ])
        ])
    )

})

component('x-job-execution-logs', ['job-id', 'execution-id', 'follow-logs'], (attrs) => {
    const jobId = attrs['job-id'];
    const executionId = attrs['execution-id'];
    const followLogs = compute(() => attrs['follow-logs'].get() === "true");
    const { log, tick } = useJobExecutionLog(() => ({
        jobId: jobId.get(),
        executionId: executionId.get()
    }));

    baseRenderer((el) => {
        tick.get();

        let pre = el.querySelector('pre');
        if (pre == null) {
            pre = h('pre', {});
            el.appendChild(pre);
        }
        if (log.reset) {
            pre.textContent = '';
            log.reset = false;
        }
        for (const chunk of log.chunks) {
            pre.appendChild(document.createTextNode(chunk));
        }
        log.chunks.splice(0, log.chunks.length);

        if (followLogs.get()) {
            window.document.documentElement.scrollTop = window.document.documentElement.scrollHeight;
        }
    });
})

component('x-duration-clock', ["start-timestamp", "end-timestamp"], (attrs) => {
    const result = compute(() => {
        const startTimestamp = attrs["start-timestamp"].get();
        const endTimestamp = attrs["end-timestamp"].get();
        const startDate = new Date(startTimestamp)
        const endDate = !!endTimestamp ? new Date(endTimestamp) : new Date()

        let duration = endDate - startDate;
        const minutes = Math.floor(duration / (60 * 1000))
        duration -= minutes * (60 * 1000);
        const seconds = Math.floor(duration / (1000))

        return [
            minutes.toString().padStart(2, '0'),
            seconds.toString().padStart(2, '0'),
        ].join(':')
    })

    effect(() => {
        if (attrs["end-timestamp"].get()) return;
        const interval = setInterval(() => {
            result.execute();
        }, 1000)
        return () => clearInterval(interval);
    })

    renderer(() => h('span', {}, result.get()));
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

component('x-router', [], () => {
    const internalUrl = useInternalUrl();
    renderer(() => {
        for (const route of ROUTES) {
            const [matcher, component] = route;
            if (matcher.test(internalUrl.get().pathname)) {
                return h(component)
            }
        }
    })
})

component('x-root', [], () => {
    renderer(() =>
        h('div', {}, [
            h('x-header'),
            h('x-router')
        ])
    )
})

// #endregion
