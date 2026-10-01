// The demo library: eight finished meetings for the seeded account.
//
// Meetings are authored as a cast and a list of spoken turns. Segment timings
// are derived from how long each turn takes to say, with the leftover time
// spread between turns as pauses, so the transcript covers the whole call the
// way a real one does. Summary items, action items, and moments point at a turn
// index; the builder turns those into the second that turn starts, which is why
// every citation in the UI lands on the line it came from.
//
// scripts/seed.mjs writes these to the database. packages/shared/seed-data.test.ts
// validates every one of them against the schemas the Worker itself parses with.

export const demoAccount = {
  email: 'demo@fathomclone.app',
  password: 'fathom-clone-demo-2026',
};

// Speech is about 2.6 words a second in a meeting.
const WORDS_PER_SECOND = 2.6;
const MIN_SEGMENT_SECONDS = 2.5;
const MIN_PAUSE_SECONDS = 0.4;

const cast = {
  ada: 'Ada Okafor',
  grace: 'Grace Lindqvist',
  mateo: 'Mateo Ruiz',
  priya: 'Priya Raman',
  tom: 'Tom Whitfield',
  hannah: 'Hannah Cole',
  daniel: 'Daniel Osei',
  yuki: 'Yuki Tanaka',
  nadia: 'Nadia Fischer',
  victor: 'Victor Brandt',
  elena: 'Elena Marsh',
  samuel: 'Samuel Adeyemi',
};

function speakers(...keys) {
  return Object.fromEntries(keys.map((key) => [key, cast[key]]));
}

const meetings = [
  {
    key: 'q4-roadmap',
    title: 'Q4 roadmap review',
    filename: 'q4-roadmap-review.mp4',
    source: 'notetaker',
    daysAgo: 2,
    hour: 10,
    durationSeconds: 3742,
    speakers: speakers(
      'ada',
      'grace',
      'mateo',
      'priya',
      'tom',
      'hannah',
      'daniel',
      'yuki',
    ),
    turns: [
      [
        'ada',
        "Right, everyone's here. Eight of us and an hour, so I want to get through the three candidate themes for Q4 and leave with one of them cut. Not deferred. Cut.",
      ],
      [
        'ada',
        "The three are ingest reliability, the reporting rewrite, and the self-serve onboarding flow. Grace, start us off with where ingest actually stands, because that's the one I keep hearing about from support.",
      ],
      [
        'grace',
        "It stands badly. We're dropping somewhere between two and four percent of events during peak windows, and the reason is that the queue consumer and the writer share a connection pool. When the writer slows down the consumer stops acking, and the broker redelivers.",
      ],
      [
        'grace',
        "So you get duplicates on top of the drops, which is the part that makes it hard to measure. I can't give you a clean number for how much we lose because the duplicates mask it.",
      ],
      [
        'daniel',
        "I pulled the numbers from last Tuesday's spike. Forty-one thousand redeliveries in an eleven minute window. That's not a tail case, that's a Tuesday.",
      ],
      [
        'hannah',
        'And I want to put a face on that, because two percent sounds survivable. We had nine tickets last month that all traced back to this, and four of them were from Brightwell, who are ninety days into a twelve month contract.',
      ],
      [
        'hannah',
        "The thing customers actually say is not that data is missing. It's that they don't trust the dashboard any more. That's much harder to walk back.",
      ],
      [
        'ada',
        "That's the part I care about. Once trust goes, the reporting rewrite doesn't matter, because nobody believes the reports either way.",
      ],
      [
        'tom',
        "Can I add the commercial side? I have two deals in late stage, Acme and one other, and both of them asked for an uptime or accuracy commitment in writing. Right now I can't give one, so I've been quiet about it, which is its own problem.",
      ],
      [
        'tom',
        "If we fix ingest I can go back to Acme with an actual number and probably close faster. If we don't, I think we lose at least one of them in Q1 on renewal rather than now.",
      ],
      [
        'priya',
        "There's a measurement problem underneath this. Our own instrumentation goes through the same pipeline it's measuring. When ingest degrades, our monitoring of ingest degrades with it, so the graphs look calmer than reality.",
      ],
      [
        'priya',
        "Whatever we decide, I want a side channel for pipeline metrics that doesn't share any infrastructure with the pipeline.",
      ],
      [
        'grace',
        "Agreed, and that's small. A day, maybe two. It's not the expensive part.",
      ],
      ['ada', 'What is the expensive part?'],
      [
        'grace',
        "Splitting the pools properly means touching the writer's transaction boundaries, and the writer is the oldest code we own. No tests worth the name. I'd want three weeks with two people, and I'd want Daniel to be one of them.",
      ],
      [
        'daniel',
        "I'd want to be. I'll say the uncomfortable thing though: three weeks is what it takes if nothing surprises us, and something always surprises us in that file. I'd plan for four and be pleased with three.",
      ],
      [
        'ada',
        'Noted. Four weeks, two people. Mateo, where does that leave the reporting rewrite?',
      ],
      [
        'mateo',
        "It leaves it where it's been for two quarters, which is designed and not built. I've got the full flow, I've tested it with six customers, and the feedback was the strongest I've had on anything here.",
      ],
      [
        'mateo',
        "But I've also stopped showing it to people, because showing someone a thing you're not going to build twice is worse than not showing them.",
      ],
      ['ada', "That's fair and I'm sorry about it."],
      [
        'mateo',
        "I'm not making a complaint. I'm saying if it doesn't go in Q4, I want it off the roadmap entirely rather than sitting at number two again. Permanently parked is kinder than perpetually next.",
      ],
      [
        'yuki',
        "From a QA point of view the rewrite is also the riskiest of the three. It changes every number on every screen. If we ship it while people already distrust the numbers, we won't be able to tell a rewrite bug from an ingest bug.",
      ],
      [
        'yuki',
        "Sequencing matters more than scope here. Ingest first makes the rewrite testable. The other order doesn't work.",
      ],
      [
        'ada',
        "That's the clearest argument I've heard all week. Say more about why.",
      ],
      [
        'yuki',
        "Because today, when a number looks wrong, we have two candidate explanations and no way to separate them. If ingest is solid, a wrong number is a rewrite bug and we fix it in an afternoon. If ingest isn't solid, every wrong number becomes a three-day investigation.",
      ],
      [
        'grace',
        "She's right and I'd have missed that. The dependency isn't technical, it's diagnostic.",
      ],
      [
        'ada',
        "Okay. So we're converging on ingest first. Which means one of the other two is the cut. Let's talk about self-serve onboarding, because nobody has defended it yet.",
      ],
      [
        'tom',
        "I'll defend it, but weakly. The pitch was that we stop spending sales time on small accounts. The reality is small accounts aren't where my time goes. My time goes to the two large deals I just mentioned.",
      ],
      [
        'tom',
        "So the thing it saves isn't actually scarce. I'd rather have the ingest number than the funnel.",
      ],
      [
        'hannah',
        "Support would feel it, but in the wrong direction. Self-serve means more accounts that nobody walked through setup with, and setup is where the misconfigurations happen. It'd grow my queue before it shrank it.",
      ],
      ['ada', "So it's a cut."],
      [
        'mateo',
        'Can I ask for it to be a real cut? Off the board, out of the deck. Not parked.',
      ],
      [
        'ada',
        "Off the board. I'll take it out of the quarterly deck today and I'll say why in the write-up, so it doesn't quietly reappear in January.",
      ],
      [
        'priya',
        "What about the part of onboarding that wasn't self-serve? The guided import. That one does reduce misconfiguration.",
      ],
      [
        'hannah',
        "That one I'd keep. It's a week of work and it removes the most common ticket I get.",
      ],
      [
        'ada',
        'Separate it out then. Guided import survives as a small piece of work, the self-serve funnel is cut. Mateo, does that split make sense to you as the person who designed both?',
      ],
      [
        'mateo',
        "It does, and it's the right line. They were only ever bundled because they shared a screen.",
      ],
      [
        'ada',
        'Good. Now the harder question. Reporting rewrite in Q4 after ingest, or Q1?',
      ],
      [
        'grace',
        "If ingest takes four weeks with two of us, there isn't a reporting rewrite in the same quarter. Not one I'd want to ship.",
      ],
      [
        'mateo',
        "Then I'd rather it be Q1 with a date than Q4 without one. A date I can plan around. A maybe I can't.",
      ],
      [
        'ada',
        "Then it's Q1, first thing, and I'll write that down as a commitment rather than an intention. Mateo, you can show the designs again.",
      ],
      ['mateo', "That's all I wanted."],
      [
        'priya',
        "Can we define what 'ingest is fixed' means before we start? Otherwise we'll argue about it in week four.",
      ],
      [
        'grace',
        "Fair. I'd say: zero redeliveries attributable to writer backpressure over a seven day window, and a drop rate we can measure, below one tenth of a percent.",
      ],
      ['priya', 'Measured on the side channel, not through the pipeline.'],
      ['grace', 'Measured on the side channel. Yes.'],
      [
        'yuki',
        "I'd add one more. I want a reproducible load test that recreates last Tuesday. Otherwise we're fixing a thing we can only observe in production.",
      ],
      [
        'daniel',
        "That's probably two days of work and it'll save us a week. I'll build it first, before touching the writer.",
      ],
      [
        'ada',
        'Do that. Hannah, what do you tell Brightwell between now and then?',
      ],
      [
        'hannah',
        "I'd like to tell them the truth, which is that we found it, it's a specific thing, and here's the week we expect it fixed. They've been patient but they've been patient without information, which is the worst kind of patient.",
      ],
      [
        'ada',
        'Tell them. Loop Tom in before you send it so the account side is consistent.',
      ],
      [
        'tom',
        "And I'll hold the accuracy commitment with Acme until Grace's seven day window has actually passed. I'd rather be two weeks late with a real number than on time with a hopeful one.",
      ],
      ['ada', 'Agreed. Let me read back what I think we decided.'],
      [
        'ada',
        "Ingest reliability is the quarter. Four weeks, Grace and Daniel, starting with Daniel's load test. Done means no backpressure redeliveries over seven days and a measured drop rate under a tenth of a percent, on a side channel Priya builds that shares nothing with the pipeline.",
      ],
      [
        'ada',
        "Guided import stays as a one week piece, owned by Hannah and Mateo together. Self-serve onboarding is cut, off the deck, and I'll say so in writing. Reporting rewrite is Q1, committed, not parked.",
      ],
      [
        'ada',
        "Hannah writes to Brightwell this week with a specific week, Tom reviews it first. Tom holds the Acme commitment until the window closes. Anything I've got wrong?",
      ],
      [
        'grace',
        'One thing. If the load test shows this is worse than we think, I want a checkpoint rather than a silent overrun. Give me a week two review.',
      ],
      [
        'ada',
        "Week two review, in the calendar before we leave. Yuki, you own the done criteria and you're the one who says whether we met them, not Grace.",
      ],
      ['yuki', 'Happy to own that.'],
      [
        'ada',
        "Then we're done, and we're done with a cut, which is the first time in three of these. Thank you, all of you.",
      ],
    ],
    templates: {
      general: {
        title: 'Q4 committed to ingest reliability; one theme cut outright',
        overview:
          'Eight people reviewed three candidate themes for Q4 and left with one cut rather than deferred. Ingest reliability takes the quarter on a diagnostic argument: while the pipeline is unreliable, no reporting bug can be distinguished from an ingest bug. Self-serve onboarding is cut off the roadmap; the reporting rewrite moves to Q1 as a commitment with a date.',
        sections: [
          {
            title: 'Decisions',
            items: [
              {
                text: 'Ingest reliability is the Q4 theme: four weeks, Grace and Daniel, beginning with a reproducible load test.',
                turn: 54,
              },
              {
                text: 'Self-serve onboarding is cut outright, off the quarterly deck, with the reason written down so it does not reappear in January.',
                turn: 32,
              },
              {
                text: 'Guided import is separated from the cut and survives as a one-week piece owned jointly by Hannah and Mateo.',
                turn: 35,
              },
              {
                text: 'The reporting rewrite moves to Q1 as a dated commitment rather than staying at number two on the list.',
                turn: 40,
              },
            ],
          },
          {
            title: 'Why ingest goes first',
            items: [
              {
                text: 'The queue consumer and writer share a connection pool, so writer backpressure stops acks and the broker redelivers: 41,000 redeliveries in an eleven minute window.',
                turn: 2,
              },
              {
                text: 'Duplicates mask the drop rate, so the two to four percent loss figure cannot be measured cleanly.',
                turn: 3,
              },
              {
                text: 'QA argued the sequencing is diagnostic, not technical: until ingest is solid, every wrong number has two explanations and takes three days to investigate.',
                turn: 24,
              },
              {
                text: 'Customers report lost trust in the dashboard rather than missing data, which is harder to recover.',
                turn: 6,
              },
            ],
          },
          {
            title: 'How done is defined',
            items: [
              {
                text: 'Zero redeliveries attributable to writer backpressure across a seven day window.',
                turn: 43,
              },
              {
                text: 'A measured drop rate below one tenth of a percent, read from a side channel that shares no infrastructure with the pipeline.',
                turn: 45,
              },
              {
                text: 'Yuki owns the done criteria and judges whether they are met, rather than the team that did the work.',
                turn: 57,
              },
              {
                text: 'A week two checkpoint is in the calendar so an overrun surfaces early instead of silently.',
                turn: 56,
              },
            ],
          },
        ],
      },
      salesCustomer: {
        title: 'Two late-stage deals are waiting on an accuracy commitment',
        overview:
          'Not a customer call, but the commercial consequences were argued directly and there is a named account at risk. Acme and one other late-stage deal both asked for a written accuracy or uptime commitment that cannot currently be given. Brightwell, ninety days into a twelve month contract, raised four of last month’s nine related tickets.',
        sections: [
          {
            title: 'Revenue at stake',
            items: [
              {
                text: 'Two late-stage deals, Acme and one other, asked for a written uptime or accuracy commitment; sales has stayed quiet rather than answer.',
                turn: 8,
              },
              {
                text: 'Sales expects at least one of the two to be lost at Q1 renewal rather than now if ingest is not fixed.',
                turn: 9,
              },
              {
                text: 'The Acme commitment will be held until Grace’s seven day measurement window has actually closed, accepting being two weeks late with a real number.',
                turn: 52,
              },
            ],
          },
          {
            title: 'Accounts at risk',
            items: [
              {
                text: 'Brightwell raised four of nine related tickets last month and is ninety days into a twelve month contract.',
                turn: 5,
              },
              {
                text: 'Brightwell gets a written update this week naming a specific week for the fix, reviewed by sales before it goes out.',
                turn: 50,
              },
              {
                text: 'The stated problem is loss of trust in the dashboard rather than missing data.',
                turn: 6,
              },
            ],
          },
          {
            title: 'Not covered on this call',
            items: [
              {
                text: 'No customer was present, so there is no pricing discussion, no commercial objection handling, and no next commercial step beyond the two items above.',
                turn: 8,
              },
            ],
          },
        ],
      },
      recruitingInterview: {
        title: 'No candidate on this call',
        overview:
          'This is an internal roadmap review between eight colleagues, not an interview. There is no candidate, no role, and nothing to assess against a hiring bar. The template is left largely empty rather than filled with inferences, and what follows is only what could be observed about how the team works.',
        sections: [
          {
            title: 'Why this template does not apply',
            items: [
              {
                text: 'All eight participants are existing colleagues; no candidate was introduced and no role was discussed.',
                turn: 0,
              },
              {
                text: 'No competency, experience, or compensation question was asked, so there is no evidence to score.',
                turn: 0,
              },
            ],
          },
          {
            title: 'Observable team signals',
            items: [
              {
                text: 'A junior QA argument changed the engineering lead’s view mid-meeting and was credited openly.',
                turn: 25,
              },
              {
                text: 'Design asked for a cut to be permanent rather than parked, and the request was granted in writing.',
                turn: 31,
              },
              {
                text: 'Ownership of the success criteria was deliberately given to someone outside the delivery team.',
                turn: 57,
              },
            ],
          },
        ],
      },
    },
    actions: [
      {
        task: 'Build a reproducible load test that recreates the Tuesday redelivery spike, before touching the writer',
        owner: 'Daniel Osei',
        timing: 'First, ahead of the writer work',
        turn: 47,
      },
      {
        task: 'Split the consumer and writer connection pools and fix the writer transaction boundaries',
        owner: 'Grace Lindqvist',
        timing: 'Four weeks',
        turn: 14,
      },
      {
        task: 'Build a pipeline metrics side channel that shares no infrastructure with the pipeline',
        owner: 'Priya Raman',
        timing: 'One to two days',
        turn: 11,
      },
      {
        task: 'Write to Brightwell naming the specific week the fix lands, with sales reviewing before it is sent',
        owner: 'Hannah Cole',
        timing: 'This week',
        turn: 50,
      },
      {
        task: 'Hold the Acme accuracy commitment until the seven day measurement window closes',
        owner: 'Tom Whitfield',
        timing: 'After the window',
        turn: 52,
      },
      {
        task: 'Remove self-serve onboarding from the quarterly deck and record why it was cut',
        owner: 'Ada Okafor',
        timing: 'Today',
        turn: 32,
      },
      {
        task: 'Deliver guided import as a one-week piece',
        owner: 'Hannah Cole and Mateo Ruiz',
        timing: 'One week',
        turn: 35,
      },
      {
        task: 'Own the ingest done criteria and judge whether they are met',
        owner: 'Yuki Tanaka',
        timing: 'End of the four weeks',
        turn: 57,
      },
      {
        task: 'Put the week two ingest checkpoint in the calendar before leaving the meeting',
        owner: 'Ada Okafor',
        timing: 'Before end of day',
        turn: 56,
      },
    ],
    moments: [
      {
        title: 'The diagnostic argument for ingest first',
        note: 'Yuki reframed sequencing: this is what actually decided the quarter.',
        turn: 24,
      },
      {
        title: 'Cut it properly, not parked',
        note: 'Mateo asks for a real cut. Worth remembering when January comes.',
        turn: 31,
      },
      {
        title: 'Definition of done',
        note: 'Seven days, no backpressure redeliveries, under 0.1% measured on the side channel.',
        turn: 43,
      },
    ],
    share: true,
  },
  {
    key: 'acme-pricing',
    title: 'Acme Corp — pricing and rollout',
    filename: 'acme-pricing-rollout.mp4',
    source: 'notetaker',
    daysAgo: 4,
    hour: 14,
    durationSeconds: 2487,
    speakers: speakers('tom', 'ada', 'nadia', 'victor'),
    turns: [
      [
        'tom',
        "Thanks for making time, both of you. Last time we left it that you'd take the two tier proposal back internally. I'd rather hear where that landed than present anything new.",
      ],
      [
        'nadia',
        "It landed about where you'd expect. The number is defensible. The shape isn't. We're being asked to commit to a seat count for twelve months when we genuinely don't know what the seat count will be in month four.",
      ],
      [
        'victor',
        "And I'll be blunter than Nadia will. The per-seat model is the objection. Not the price. If you told me the same annual total and called it something else, I'd have signed already.",
      ],
      ['tom', "That's useful. What is the something else?"],
      [
        'victor',
        "Volume. We know roughly how many events we'll push, give or take thirty percent. We don't know how many of our analysts will log in, because that depends on a reorg that hasn't happened yet.",
      ],
      [
        'ada',
        'Can I ask what happens to the reorg if it goes the other way? I want to understand the range, not just the midpoint.',
      ],
      [
        'nadia',
        "If it goes the other way we consolidate two teams and the seat count halves. That's the scenario where a twelve month seat commitment becomes something I have to explain to my director every month.",
      ],
      [
        'ada',
        "Then I understand the objection properly, and I think it's right. You're not asking for a discount, you're asking not to carry a risk you can't price.",
      ],
      ['nadia', "That's exactly it. Thank you."],
      [
        'tom',
        "So let me put something on the table. Volume-based, committed annual spend at the same total, with seats unlimited inside it. You'd be buying throughput, not people.",
      ],
      [
        'victor',
        "That I can take to finance without a conversation about headcount. What's the throughput number?",
      ],
      [
        'tom',
        "I'd want to set it from your actual traffic rather than guess. Can you give us two weeks of event volume?",
      ],
      ['victor', 'I can give you ninety days. We keep it.'],
      ['tom', 'Ninety days is better than I asked for.'],
      [
        'ada',
        "There's something I need to raise before we go further, and I'd rather raise it than have you find it. You asked for an accuracy commitment in writing. We're not able to give you one this quarter.",
      ],
      ['nadia', 'Go on.'],
      [
        'ada',
        "We have a known defect in our ingest pipeline. Under peak load we drop a small percentage of events and redeliver others. We've found the cause, it's a specific thing, and it's the whole of our engineering work for this quarter. Four weeks of work, then a seven day measurement window.",
      ],
      ['victor', 'How small is small?'],
      [
        'ada',
        "Between two and four percent at peak, and I want to be honest that the range is wide because the duplicates make it hard to measure precisely. That's part of what we're fixing.",
      ],
      [
        'victor',
        "I appreciate you saying it. I'd have found it in the pilot and then we'd be having a worse conversation.",
      ],
      [
        'nadia',
        "What does that mean for the rollout timeline? Because if we're buying throughput and the throughput measurement is unreliable, that's circular.",
      ],
      [
        'ada',
        "It's a fair catch. I'd propose the commitment period doesn't start until the measurement window has closed and we can show you the number. So you're not paying for throughput we can't count.",
      ],
      [
        'tom',
        'And practically that means a pilot through to the end of the quarter on the current terms, then the volume agreement starts when the number is real.',
      ],
      [
        'victor',
        "That works. I'd want the number shared with us, not just asserted.",
      ],
      [
        'ada',
        "You'd get the actual seven day measurement, from a monitoring path that's independent of the pipeline it's measuring. We're building that specifically because our own graphs were too optimistic.",
      ],
      [
        'nadia',
        "That's a more honest answer than I expected and it makes the rest of this easier.",
      ],
      ['tom', "On rollout, who's the first team in?"],
      [
        'nadia',
        "Analytics, eleven people. They're the ones who've been asking. If they're happy, the rest follows without me pushing.",
      ],
      [
        'victor',
        "And if they're not happy in the pilot, we stop. I want that written down too.",
      ],
      ['tom', "It should be. A pilot you can't exit isn't a pilot."],
      [
        'ada',
        "One more thing from our side. The reporting rewrite that Mateo showed you in August is now committed for Q1 with a date. It wasn't committed when you saw it, and I don't want you to have bought on the strength of a maybe.",
      ],
      [
        'nadia',
        'We did factor it in, so that matters. Q1 with a date is fine. Q1 as an aspiration would not have been.',
      ],
      [
        'tom',
        "Then let me say back what I think we've agreed, and you correct me.",
      ],
      [
        'tom',
        'Volume-based pricing at the same annual total, seats unlimited. Throughput set from ninety days of your real event data, which Victor sends this week. Pilot with the eleven person analytics team on current terms through the end of the quarter, exit available at any point.',
      ],
      [
        'tom',
        "The volume commitment starts only once our seven day accuracy measurement has closed and we've shared the actual number with you. Reporting rewrite is Q1, dated. Anything missing?",
      ],
      [
        'victor',
        "The exit clause wording. I want it specific, not 'by mutual agreement'.",
      ],
      [
        'tom',
        "Thirty days written notice, no reason required, no penalty. I'll have it drafted that way.",
      ],
      ['nadia', "Then I think we're agreed, subject to the paper."],
      [
        'ada',
        "Thank you both, genuinely, for being direct about the seat model. We'd have kept presenting it.",
      ],
    ],
    templates: {
      general: {
        title:
          'Acme moves from per-seat to volume pricing; commitment gated on a measurement',
        overview:
          'The blocker was the shape of the deal rather than its price: a twelve month seat commitment ahead of an unresolved reorg. Pricing moves to volume at the same annual total with unlimited seats. A known ingest defect was disclosed unprompted, and the volume commitment now starts only after an independent seven day accuracy measurement is shared.',
        sections: [
          {
            title: 'What was agreed',
            items: [
              {
                text: 'Volume-based pricing at the same annual total, seats unlimited inside it.',
                turn: 9,
              },
              {
                text: 'Throughput set from ninety days of real event data rather than an estimate.',
                turn: 12,
              },
              {
                text: 'Pilot with the eleven person analytics team on current terms to quarter end, with a thirty day no-reason exit.',
                turn: 36,
              },
              {
                text: 'The volume commitment starts only once the seven day accuracy measurement closes and the number is shared.',
                turn: 22,
              },
            ],
          },
          {
            title: 'What was disclosed',
            items: [
              {
                text: 'A known ingest defect was raised before the customer could find it: two to four percent of events dropped at peak, with redeliveries.',
                turn: 16,
              },
              {
                text: 'The measurement range is wide because duplicates obscure it, which is itself part of the fix.',
                turn: 18,
              },
              {
                text: 'The reporting rewrite the customer saw in August is now a dated Q1 commitment rather than an aspiration.',
                turn: 30,
              },
            ],
          },
        ],
      },
      salesCustomer: {
        title: 'Per-seat was the objection, not price',
        overview:
          'Acme stated plainly that the annual total was defensible and the per-seat structure was not, because a pending reorg could halve the seat count. Restructuring to volume removed the objection without moving the number. The pilot is exit-able on thirty days notice and the commitment is gated on evidence rather than assertion.',
        sections: [
          {
            title: 'Objection and resolution',
            items: [
              {
                text: 'Stated directly: the same annual total under a different structure would already have been signed.',
                turn: 2,
              },
              {
                text: 'The risk being refused is unpriceable seat count, not cost: a reorg could halve the analyst headcount.',
                turn: 6,
              },
              {
                text: 'Resolved by selling throughput instead of people, which finance can approve without a headcount conversation.',
                turn: 10,
              },
            ],
          },
          {
            title: 'Buying process',
            items: [
              {
                text: 'Economic approver is finance, reached through Victor; Nadia is the internal sponsor who must defend the shape monthly.',
                turn: 10,
              },
              {
                text: 'Analytics, eleven people, is the first team in and the internal reference that unblocks the rest.',
                turn: 27,
              },
              {
                text: 'Exit wording was pushed back on: thirty days written notice, no reason, no penalty, not "by mutual agreement".',
                turn: 36,
              },
            ],
          },
          {
            title: 'Risks on this deal',
            items: [
              {
                text: 'The throughput measurement depends on the pipeline being fixed, which the customer identified as circular.',
                turn: 21,
              },
              {
                text: 'Commercial close now trails the engineering measurement window by design.',
                turn: 23,
              },
            ],
          },
        ],
      },
      recruitingInterview: {
        title: 'No candidate on this call',
        overview:
          'This is a commercial conversation with two customer-side participants, not an interview. No candidate was present and no role was discussed, so there is nothing to assess against a hiring bar and this template is left empty on purpose.',
        sections: [
          {
            title: 'Why this template does not apply',
            items: [
              {
                text: 'The two external participants are a customer sponsor and a budget approver, not candidates.',
                turn: 1,
              },
              {
                text: 'No role, competency, or compensation question was raised at any point.',
                turn: 0,
              },
            ],
          },
          {
            title: 'What was discussed instead',
            items: [
              {
                text: 'Pricing structure, rollout sequencing, and a disclosed product defect.',
                turn: 9,
              },
            ],
          },
        ],
      },
    },
    actions: [
      {
        task: 'Send ninety days of event volume data for throughput sizing',
        owner: 'Victor Brandt',
        timing: 'This week',
        turn: 12,
      },
      {
        task: 'Redraft the agreement as volume-based with unlimited seats at the same annual total',
        owner: 'Tom Whitfield',
        timing: 'Before the next call',
        turn: 9,
      },
      {
        task: 'Draft the exit clause as thirty days written notice, no reason required, no penalty',
        owner: 'Tom Whitfield',
        timing: 'With the paper',
        turn: 36,
      },
      {
        task: 'Share the seven day accuracy measurement with Acme once the window closes',
        owner: 'Ada Okafor',
        timing: 'After the measurement window',
        turn: 24,
      },
      {
        task: 'Start the analytics team pilot on current terms',
        owner: 'Nadia Fischer',
        timing: 'Through quarter end',
        turn: 27,
      },
    ],
    moments: [
      {
        title: 'Per-seat is the objection, not price',
        note: 'Victor says it outright. This is the whole call in one line.',
        turn: 2,
      },
      {
        title: 'Disclosing the ingest defect',
        note: 'Told them before they found it. Changed the tone of everything after.',
        turn: 16,
      },
      {
        title: 'Commitment gated on the measurement',
        note: 'Useful framing to reuse on other deals.',
        turn: 22,
      },
    ],
    share: true,
  },
  {
    key: 'interview-platform',
    title: 'Interview — Senior Platform Engineer',
    filename: 'interview-senior-platform-engineer.mp4',
    source: 'notetaker',
    daysAgo: 6,
    hour: 11,
    durationSeconds: 2805,
    speakers: speakers('grace', 'daniel', 'samuel'),
    turns: [
      [
        'grace',
        "Thanks for coming in, Samuel. I'm Grace, I lead engineering, and this is Daniel who works on our platform. We've got about forty five minutes. I'd like to spend most of it on one real problem rather than a tour of your CV.",
      ],
      ['samuel', 'That suits me better anyway.'],
      [
        'grace',
        'So. We have a queue consumer and a database writer that share a connection pool. Under load the writer slows, the consumer stops acknowledging, and the broker redelivers. Forty one thousand redeliveries in eleven minutes, as a real example. Where do you start?',
      ],
      [
        'samuel',
        'First question: do you know whether the redeliveries are actually causing duplicate writes, or are they idempotent on the way in?',
      ],
      ['daniel', 'Why is that your first question?'],
      [
        'samuel',
        "Because it changes whether this is an availability problem or a correctness problem, and those get different urgency and different fixes. If writes are idempotent, redelivery is just wasted capacity and I can take my time. If they're not, I have a data integrity incident and I'd stop the bleeding before I understood it fully.",
      ],
      [
        'grace',
        "They're not idempotent. There's a unique constraint on some tables and not others.",
      ],
      [
        'samuel',
        "Then I'd want to know which tables, and I'd expect the ones without the constraint to be quietly wrong already. Not from the spike, from every spike before it. I'd check that before I fixed anything, because the fix will stop new damage and hide the old.",
      ],
      ['grace', "That's the right answer and it's one we got to late."],
      [
        'samuel',
        "It's an easy one to miss under pressure. The instinct is to stop the alarm.",
      ],
      [
        'daniel',
        "Say you've established it's a correctness problem. Now what?",
      ],
      [
        'samuel',
        "Separating the pools is the obvious structural fix, and I'd do it, but I wouldn't do it first. First I'd want a way to reproduce the spike outside production, because otherwise I can't tell whether I've fixed it or whether Tuesday just didn't happen again.",
      ],
      ['daniel', 'How long would you spend building that?'],
      [
        'samuel',
        "A day or two. If it's longer than that I've probably over-built it. It only needs to produce the backpressure condition, not simulate your whole traffic shape.",
      ],
      ['daniel', "That's roughly what I estimated and I had to argue for it."],
      [
        'samuel',
        "I'd expect to. It looks like a detour when there's a known fix available. The argument I'd make is that without it, the seven day quiet period after your fix is indistinguishable from luck.",
      ],
      [
        'grace',
        "You used the phrase 'seven day quiet period' without me giving you that. Why seven?",
      ],
      [
        'samuel',
        "Because load problems are usually weekly. If your peak is Tuesday and you watch for three days starting Wednesday, you've learned nothing. Seven days catches one of each day.",
      ],
      [
        'grace',
        "Good. Now the harder part. You've split the pools and the writer still has no tests and the transaction boundaries are tangled. You've got four weeks total. How do you spend them?",
      ],
      [
        'samuel',
        "I'd want to write tests around the behaviour I'm about to change, not the code. Characterisation tests at the boundary, so I can refactor underneath them. Writing unit tests for tangled code tends to cement the tangle.",
      ],
      [
        'samuel',
        "Then I'd go in small steps with the load test running. The thing I'd resist is the rewrite instinct. Four weeks is enough to carefully fix this or to half-rewrite it, and a half-rewritten writer is worse than the tangle.",
      ],
      [
        'daniel',
        'Have you been in the position of arguing against a rewrite and losing?',
      ],
      [
        'samuel',
        "Twice. Once I was right and once I wasn't. The time I wasn't, the system was genuinely past saving and I was attached to it because I'd written a lot of it. I've tried to be more suspicious of my own reluctance since.",
      ],
      ['grace', "That's a better answer than a clean one would have been."],
      [
        'daniel',
        "Let's go sideways. Your monitoring of the pipeline runs through the pipeline. Thoughts?",
      ],
      [
        'samuel',
        "That's a problem and it's a common one. When the thing degrades, your view of the degradation degrades with it, so you systematically underestimate your own outages. I'd want a path that shares nothing: different transport, different store, ideally a different provider.",
      ],
      [
        'samuel',
        "I'd also want it to be deliberately crude. If it's sophisticated it'll grow dependencies and end up coupled again. A counter and a timestamp pushed somewhere dumb is more trustworthy than a nice dashboard.",
      ],
      [
        'grace',
        "We're building exactly that this quarter and 'deliberately crude' is a better framing than we had.",
      ],
      [
        'daniel',
        "Last technical one. You've fixed it, the seven days are clean. How do you know you haven't just moved the bottleneck?",
      ],
      [
        'samuel',
        "I wouldn't know from the quiet alone. I'd want to see where the new limit is by pushing the load test past the old peak until something gives. Finding the next bottleneck on purpose is cheaper than finding it on a Tuesday.",
      ],
      ['grace', 'Do you have questions for us?'],
      [
        'samuel',
        'Yes. When the four weeks turns into six, what happens? Not whether it might, because it usually does. I want to know what the conversation looks like.',
      ],
      [
        'grace',
        "There's a week two checkpoint in the calendar for precisely that, and the person who decides whether we've met the criteria is in QA, not in my team. I didn't want the people doing the work grading the work.",
      ],
      [
        'samuel',
        "That's a good answer. The failure mode I've lived through is the checkpoint existing and being a status update rather than a decision.",
      ],
      [
        'daniel',
        "It's a decision. We cut a whole theme off the roadmap last week, so it's not a team that can't say no.",
      ],
      [
        'samuel',
        'Then my second question is smaller. How much of this work would be mine versus shared?',
      ],
      [
        'daniel',
        "Shared, with me. I'd rather pair on the writer than split it, given the state of it.",
      ],
      ['samuel', "I'd prefer that too, for that file specifically."],
      [
        'grace',
        "Then I think we're done. Thank you, that was a good use of forty five minutes.",
      ],
    ],
    templates: {
      general: {
        title: 'Strong technical interview; recommend advancing',
        overview:
          'A single real problem was used in place of a CV walkthrough. The candidate repeatedly reached for the question behind the question, separated correctness from availability unprompted, and argued for reproduction before repair. Two answers improved the interviewers’ own framing of work already in flight.',
        sections: [
          {
            title: 'Strongest signals',
            items: [
              {
                text: 'Opened by asking whether redelivery caused duplicate writes, to separate a correctness incident from an availability one.',
                turn: 3,
              },
              {
                text: 'Identified that tables without a unique constraint are likely already wrong from earlier spikes, and that fixing first would hide the old damage.',
                turn: 7,
              },
              {
                text: 'Arrived at a seven day observation window independently, reasoning that load problems are weekly.',
                turn: 17,
              },
              {
                text: 'Proposed characterisation tests at the boundary rather than unit tests that would cement the tangle.',
                turn: 19,
              },
            ],
          },
          {
            title: 'Judgement and self-awareness',
            items: [
              {
                text: 'Described losing a rewrite argument where he was wrong, and attributed it to attachment to his own code.',
                turn: 22,
              },
              {
                text: 'Resisted the rewrite instinct on a four week budget, calling a half-rewritten writer worse than the tangle.',
                turn: 20,
              },
              {
                text: 'Asked what happens when four weeks becomes six, and named the failure mode of a checkpoint that is a status update rather than a decision.',
                turn: 32,
              },
            ],
          },
          {
            title: 'Where he changed our thinking',
            items: [
              {
                text: '"Deliberately crude" as the design constraint for an independent monitoring path, so it cannot grow dependencies and recouple.',
                turn: 26,
              },
              {
                text: 'Pushing the load test past the old peak on purpose, to locate the next bottleneck before production does.',
                turn: 30,
              },
            ],
          },
        ],
      },
      salesCustomer: {
        title: 'Not a customer call',
        overview:
          'This is a hiring interview. There is no customer, no opportunity, and no commercial content, so the sales template has nothing to populate and is left empty rather than filled by inference.',
        sections: [
          {
            title: 'Why this template does not apply',
            items: [
              {
                text: 'The external participant is a candidate for a platform engineering role, not a buyer.',
                turn: 0,
              },
              {
                text: 'No pricing, procurement, or commercial next step appears anywhere in the transcript.',
                turn: 0,
              },
            ],
          },
          {
            title: 'Only commercially adjacent mention',
            items: [
              {
                text: 'The ingest defect discussed as an interview problem is the same one affecting customer accounts.',
                turn: 2,
              },
            ],
          },
        ],
      },
      recruitingInterview: {
        title: 'Senior Platform Engineer — advance, pair-oriented',
        overview:
          'Assessed on one production problem for forty five minutes. Evidence was strong on debugging order, test strategy under time pressure, and self-awareness about past misjudgement. He asked two questions about how the team behaves when estimates slip, which were the sharpest questions of the session.',
        sections: [
          {
            title: 'Technical depth',
            items: [
              {
                text: 'Separated correctness from availability before proposing any fix, and said why the urgency differs.',
                turn: 5,
              },
              {
                text: 'Scoped a reproduction harness to one or two days and named over-building as the risk.',
                turn: 13,
              },
              {
                text: 'Chose characterisation tests at the behavioural boundary over unit tests on tangled code.',
                turn: 19,
              },
              {
                text: 'Would deliberately push past the old peak after the fix to locate the next bottleneck.',
                turn: 30,
              },
            ],
          },
          {
            title: 'Collaboration and ways of working',
            items: [
              {
                text: 'Preferred pairing on the legacy writer over splitting it, agreeing with the interviewer unprompted.',
                turn: 37,
              },
              {
                text: 'Expected to have to argue for the load test and had the argument ready.',
                turn: 15,
              },
              {
                text: 'Volunteered a case where he was wrong and what he changed as a result.',
                turn: 22,
              },
            ],
          },
          {
            title: 'Open questions for the next stage',
            items: [
              {
                text: 'No evidence gathered on incident command or on-call leadership; worth probing next round.',
                turn: 0,
              },
              {
                text: 'Compensation and notice period were not discussed on this call.',
                turn: 32,
              },
            ],
          },
        ],
      },
    },
    actions: [
      {
        task: 'Advance Samuel to the final stage and schedule the on-call and incident command conversation',
        owner: 'Grace Lindqvist',
        timing: 'This week',
        turn: 39,
      },
      {
        task: 'Audit tables without a unique constraint for duplicate writes from earlier spikes, before the ingest fix hides them',
        owner: 'Daniel Osei',
        timing: 'Before the writer work',
        turn: 7,
      },
      {
        task: 'Rewrite the monitoring side channel brief around being deliberately crude so it cannot recouple',
        owner: 'Priya Raman',
        timing: 'Before build starts',
        turn: 26,
      },
      {
        task: 'Extend the load test plan to push past the old peak and locate the next bottleneck',
        owner: 'Daniel Osei',
        timing: 'After the seven day window',
        turn: 30,
      },
    ],
    moments: [
      {
        title: 'Correctness or availability first',
        note: 'Best answer of the interview, and it was his opening question.',
        turn: 5,
      },
      {
        title: 'Deliberately crude monitoring',
        note: 'Changed how we are scoping the side channel.',
        turn: 26,
      },
      {
        title: 'When four weeks becomes six',
        note: 'He interviewed us back, and well.',
        turn: 32,
      },
    ],
    share: false,
  },
  {
    key: 'incident-retro',
    title: 'Incident retro — ingest backlog',
    filename: 'incident-retro-ingest-backlog.mp4',
    source: 'notetaker',
    daysAgo: 9,
    hour: 16,
    durationSeconds: 2166,
    speakers: speakers('grace', 'daniel', 'priya', 'yuki', 'hannah'),
    turns: [
      [
        'grace',
        "This is a blameless retro on Tuesday's backlog. Eleven minutes of degradation, forty one thousand redeliveries. Daniel has the timeline, then I want to spend most of the hour on why we found out from a customer rather than from a graph.",
      ],
      [
        'daniel',
        '14:02, write latency starts climbing. 14:06, the consumer stops acking. 14:06 to 14:17, redelivery storm. 14:19, Hannah forwards a Brightwell ticket. 14:24, I open the dashboard and it looks fine.',
      ],
      [
        'daniel',
        "That's the part that matters. At 14:24, eighteen minutes in, our own dashboard showed nothing unusual.",
      ],
      [
        'priya',
        'Because the dashboard is fed by the pipeline that was degraded. The metrics describing the outage were queued behind the outage. When the queue drained at 14:17 the metrics arrived too, backdated, so even afterwards the graph looked like a small bump.',
      ],
      [
        'grace',
        "So our instrumentation didn't just miss it. It actively smoothed it.",
      ],
      [
        'priya',
        'It averaged it away. An eleven minute cliff arriving as forty minutes of slightly-elevated numbers looks like normal variance.',
      ],
      [
        'yuki',
        'I want to note that this is the second time. There was a similar case in July and we logged it as a monitoring gap, and the gap is still there.',
      ],
      [
        'grace',
        "That's fair and it's on me. It went on the list and the list isn't a plan.",
      ],
      [
        'hannah',
        "Can I say what it looked like from support? Brightwell's message didn't say data was missing. It said 'are your numbers reliable at the moment', which I couldn't answer, so I asked engineering, and engineering said the dashboard was fine.",
      ],
      [
        'hannah',
        "So for about twenty minutes I was telling a customer things were normal while they were watching them not be normal. That's the bit I'd most like not to repeat.",
      ],
      [
        'daniel',
        'And you were telling them what we told you. The failure is upstream of support.',
      ],
      [
        'priya',
        'The fix is an independent path. Different transport, different store, nothing shared with the pipeline. And it should be crude on purpose, because a sophisticated one will grow dependencies and end up coupled again.',
      ],
      [
        'yuki',
        "I'd want an alert on it that doesn't depend on anyone looking at a dashboard. The dashboard was available on Tuesday. Nobody opened it until eighteen minutes in.",
      ],
      ['grace', "Agreed. What's the alert condition?"],
      [
        'priya',
        "Consumer ack rate dropping below a floor for more than sixty seconds. That's the earliest honest signal we had on Tuesday, and it would have fired at 14:07.",
      ],
      ['daniel', 'Twelve minutes before the customer told us.'],
      [
        'grace',
        'Good. Now the second thing. Why did the writer slow down in the first place?',
      ],
      [
        'daniel',
        'A reporting query. Someone ran an unbounded aggregate over the events table from the admin console, it took locks, and the writer queued behind it.',
      ],
      ['yuki', 'So a read took down writes.'],
      [
        'daniel',
        'A read in a console with no timeout and no separate role, yes.',
      ],
      [
        'grace',
        "That's three separate failures stacked, and any one of them breaks the chain. The shared pool, the unbounded console query, and the blind monitoring.",
      ],
      ['priya', "I'd add a fourth: we knew about the monitoring one in July."],
      ['grace', "Yes. Let's not soften that."],
      [
        'hannah',
        'What do I tell Brightwell? Right now they have an apology and no explanation.',
      ],
      [
        'grace',
        "Tell them all three causes plainly and the week each fix lands. They've earned specifics. Send it to me first, not to vet it, just so I can sign it.",
      ],
      [
        'yuki',
        "And can we agree the retro action list goes into the quarter's plan rather than a document? July's list was a document.",
      ],
      [
        'grace',
        "That's the actual lesson here. Ingest is now the whole quarter's theme, so these aren't side items any more. The console timeout and the alert go in this week, not in four weeks.",
      ],
      [
        'daniel',
        "I'll do the console timeout today. It's a configuration change and a separate read role.",
      ],
      ['priya', 'Alert and side channel by end of week. Crude version first.'],
      [
        'grace',
        "Then we're done. Thank you, and particularly thank you Hannah for raising the uncomfortable part, which is that we had you reassuring a customer on bad information.",
      ],
    ],
    templates: {
      general: {
        title: 'Three stacked causes; monitoring failure was known since July',
        overview:
          'Eleven minutes of ingest degradation, found from a customer ticket eighteen minutes in rather than from monitoring. Three independent failures stacked, and a fourth finding: the monitoring gap had been logged in July and never scheduled. Support spent twenty minutes reassuring a customer on information engineering had wrongly confirmed.',
        sections: [
          {
            title: 'Causes',
            items: [
              {
                text: 'An unbounded aggregate run from the admin console took locks, so a read stalled all writes.',
                turn: 17,
              },
              {
                text: 'The consumer and writer share a connection pool, so writer backpressure stopped acks and triggered redelivery.',
                turn: 0,
              },
              {
                text: 'Pipeline metrics travel through the pipeline, so the outage queued behind itself and arrived backdated, averaging an eleven minute cliff into normal variance.',
                turn: 3,
              },
              {
                text: 'The monitoring gap was logged in July and never scheduled, because the list was not a plan.',
                turn: 6,
              },
            ],
          },
          {
            title: 'Timeline',
            items: [
              {
                text: '14:02 write latency climbs; 14:06 consumer stops acking; 14:06–14:17 redelivery storm.',
                turn: 1,
              },
              {
                text: '14:19 a Brightwell ticket arrives; 14:24 the dashboard still shows nothing unusual.',
                turn: 1,
              },
              {
                text: 'An ack-rate alert would have fired at 14:07, twelve minutes before the customer told us.',
                turn: 15,
              },
            ],
          },
          {
            title: 'Fixes and sequencing',
            items: [
              {
                text: 'Console query timeout and a separate read role, same day, as a configuration change.',
                turn: 28,
              },
              {
                text: 'Crude independent metrics path plus an ack-rate alert by end of week, ahead of the structural work.',
                turn: 29,
              },
              {
                text: 'Retro actions go into the quarter plan rather than a document, which is what failed in July.',
                turn: 26,
              },
            ],
          },
        ],
      },
      salesCustomer: {
        title: 'Brightwell is owed an explanation, not just an apology',
        overview:
          'No customer attended, but one named account drove the discovery and is owed a specific account of what happened. Support was placed in the position of reassuring that customer on information engineering had confirmed and which was wrong.',
        sections: [
          {
            title: 'Customer impact',
            items: [
              {
                text: 'Brightwell reported the incident before monitoring did, asking whether the numbers were currently reliable.',
                turn: 8,
              },
              {
                text: 'Support spent roughly twenty minutes telling the customer things were normal while they were not.',
                turn: 9,
              },
            ],
          },
          {
            title: 'Commitment made',
            items: [
              {
                text: 'Brightwell gets all three causes stated plainly plus the week each fix lands, signed off by engineering leadership.',
                turn: 24,
              },
            ],
          },
          {
            title: 'Not covered on this call',
            items: [
              {
                text: 'No commercial remedy, credit, or contract discussion took place; this was an engineering retro.',
                turn: 0,
              },
            ],
          },
        ],
      },
      recruitingInterview: {
        title: 'No candidate on this call',
        overview:
          'An internal blameless incident review between five colleagues. No candidate, no role, nothing to assess, so this template is intentionally empty.',
        sections: [
          {
            title: 'Why this template does not apply',
            items: [
              {
                text: 'All five participants are existing colleagues conducting a retro.',
                turn: 0,
              },
              {
                text: 'No hiring, role, or assessment topic appears in the transcript.',
                turn: 0,
              },
            ],
          },
          {
            title: 'Observable team signals',
            items: [
              {
                text: 'Leadership accepted responsibility for the unscheduled July action without deflecting.',
                turn: 7,
              },
              {
                text: 'Support was thanked specifically for raising the most uncomfortable finding.',
                turn: 30,
              },
            ],
          },
        ],
      },
    },
    actions: [
      {
        task: 'Add a statement timeout and a separate read-only role for the admin console',
        owner: 'Daniel Osei',
        timing: 'Today',
        turn: 28,
      },
      {
        task: 'Ship the crude independent metrics path and an ack-rate alert firing after sixty seconds below floor',
        owner: 'Priya Raman',
        timing: 'End of week',
        turn: 29,
      },
      {
        task: 'Write to Brightwell with all three causes and the week each fix lands, for Grace to sign',
        owner: 'Hannah Cole',
        timing: 'This week',
        turn: 24,
      },
      {
        task: 'Move retro actions into the quarter plan instead of a document',
        owner: 'Grace Lindqvist',
        timing: 'This week',
        turn: 26,
      },
    ],
    moments: [
      {
        title: 'The dashboard smoothed the outage away',
        note: 'Priya explaining why our own graphs lied. Core finding.',
        turn: 3,
      },
      {
        title: 'We knew in July',
        note: 'Yuki naming the repeat. Do not let this soften.',
        turn: 6,
      },
      {
        title: 'Support reassuring on bad information',
        note: 'The consequence that matters most.',
        turn: 9,
      },
    ],
    share: true,
  },
  {
    key: 'brightwell-onboarding',
    title: 'Brightwell onboarding — week one check-in',
    filename: 'brightwell-onboarding-week-one.mp4',
    source: 'notetaker',
    daysAgo: 12,
    hour: 9,
    durationSeconds: 1688,
    speakers: speakers('hannah', 'mateo', 'elena'),
    turns: [
      [
        'hannah',
        "Morning Elena. One week in, so I mostly want to hear what's gone wrong rather than what's gone right. Mateo's here because most of what goes wrong in week one is a design problem, not a support one.",
      ],
      [
        'elena',
        "That's a refreshing way to open. The honest answer is that the import was harder than it should have been and everything after it has been fine.",
      ],
      [
        'mateo',
        'Can you walk me through the import as you experienced it? Not what you think went wrong, just what you did.',
      ],
      [
        'elena',
        'I uploaded our events file, it accepted it, and then nothing seemed to happen for about four minutes. I assumed it had failed so I uploaded it again. Then both appeared and I had everything twice.',
      ],
      [
        'mateo',
        'So there was no progress indication during those four minutes.',
      ],
      [
        'elena',
        'There was a spinner. But a spinner for four minutes reads as broken rather than busy.',
      ],
      [
        'hannah',
        "That's the single most common ticket I get, and it's always the second upload rather than the first.",
      ],
      [
        'mateo',
        "This is useful and it's exactly the thing the guided import work is meant to cover. Can I ask what you'd have needed to see to wait?",
      ],
      [
        'elena',
        "A number. Rows processed out of rows total. Even a rough one. I don't need it to be accurate, I need it to be moving.",
      ],
      ['mateo', "Moving matters more than accurate. That's a good constraint."],
      [
        'elena',
        'And then ideally it would have refused the second upload, or at least asked.',
      ],
      [
        'hannah',
        "That's a better fix than the progress bar, honestly. The progress bar prevents the confusion, the duplicate check prevents the damage.",
      ],
      ['mateo', 'Both, but the duplicate check first if I only get one.'],
      ['hannah', 'How did you get rid of the duplicates in the end?'],
      [
        'elena',
        "I didn't. Your colleague did it for me on a call, and I still don't know how, which means if it happens again I'm raising another ticket.",
      ],
      [
        'hannah',
        "That's on us. I'll send you the steps today, and I'll also flag that it shouldn't need steps.",
      ],
      [
        'elena',
        'After that it was genuinely good. The transcript search is the thing my team has latched onto. Two of them found it without being shown.',
      ],
      ['mateo', 'What were they searching for?'],
      [
        'elena',
        'Commitments. Someone said a date on a call three weeks ago and nobody could remember which call. They found it in about ten seconds and that was the moment the team stopped humouring me about this.',
      ],
      [
        'hannah',
        "That's the use case we most underplay in onboarding. We lead with summaries and search is what sticks.",
      ],
      [
        'elena',
        'Summaries are good too. The template switching surprised me. I expected it to be marketing.',
      ],
      ['mateo', 'What surprised you about it?'],
      [
        'elena',
        'That when I put a sales template on an internal meeting it told me there was no customer present instead of inventing a buying process. I trusted the other summaries more after seeing that.',
      ],
      [
        'mateo',
        'That was the most argued-about decision in the whole feature, so thank you for saying so.',
      ],
      ['hannah', "Anything you've looked for and not found?"],
      [
        'elena',
        'A way to send one clip to someone without giving them the whole meeting. Half my recordings have a bit in the middle that one person needs and the rest is not theirs to read.',
      ],
      [
        'hannah',
        "That exists. That's moments, and it's my failure that you got through a week without knowing. I'll show you now and then send it in writing.",
      ],
      ['elena', "If it already exists then that's my week sorted."],
      [
        'hannah',
        "Last thing, and I'd rather raise it than have you discover it. You've seen some reliability wobble in your numbers. That's a real defect on our side, we've found the cause, and it's the whole of our engineering quarter. You'll get a written note with the week it lands.",
      ],
      [
        'elena',
        "I did notice and I'd assumed it was us. Knowing it isn't is worth more than the fix being soon.",
      ],
    ],
    templates: {
      general: {
        title:
          'Import is the only real friction; search is what made the team adopt it',
        overview:
          'One week in, the import flow caused a duplicate upload and the duplicates needed a support call to clear. Everything after import went well. Transcript search, not summaries, is what made the customer’s team adopt the product, and the template honesty behaviour increased their trust in the summaries.',
        sections: [
          {
            title: 'What went wrong',
            items: [
              {
                text: 'A four minute import showed only a spinner, which read as broken, so the file was uploaded twice and everything duplicated.',
                turn: 3,
              },
              {
                text: 'Clearing the duplicates needed a support call and the customer still cannot do it unaided.',
                turn: 14,
              },
              {
                text: 'Moments were never surfaced during onboarding, so a whole week passed with the customer wanting a feature that already exists.',
                turn: 25,
              },
            ],
          },
          {
            title: 'What worked',
            items: [
              {
                text: 'Two of the customer’s team found transcript search unprompted and used it to locate a commitment from three weeks earlier.',
                turn: 17,
              },
              {
                text: 'Template switching reporting missing evidence rather than inventing a buying process increased trust in every other summary.',
                turn: 22,
              },
            ],
          },
          {
            title: 'Design direction from this call',
            items: [
              {
                text: 'Progress needs to be moving rather than accurate: rows processed out of total, however rough.',
                turn: 8,
              },
              {
                text: 'A duplicate upload check matters more than the progress indicator, because it prevents damage rather than confusion.',
                turn: 11,
              },
            ],
          },
        ],
      },
      salesCustomer: {
        title: 'Brightwell, week one: adopted, with one fixable friction',
        overview:
          'A ninety day account inside a twelve month contract. Adoption is real and came from transcript search rather than the features onboarding leads with. One friction point in import produced duplicate data and a support dependency. The known reliability defect was disclosed proactively and received well.',
        sections: [
          {
            title: 'Account health',
            items: [
              {
                text: 'Two team members adopted search without being shown, which ended internal scepticism about the tool.',
                turn: 17,
              },
              {
                text: 'The customer had attributed the reliability wobble to their own setup; being told otherwise was valued above the fix timing.',
                turn: 28,
              },
              {
                text: 'A support dependency remains for clearing duplicates, which would generate repeat tickets.',
                turn: 14,
              },
            ],
          },
          {
            title: 'Commitments made to the customer',
            items: [
              {
                text: 'Duplicate-clearing steps sent the same day, with an acknowledgement that it should not require steps.',
                turn: 15,
              },
              {
                text: 'Moments demonstrated live on the call and followed up in writing.',
                turn: 26,
              },
              {
                text: 'A written note naming the week the reliability fix lands.',
                turn: 28,
              },
            ],
          },
          {
            title: 'Onboarding changes implied',
            items: [
              {
                text: 'Lead onboarding with transcript search rather than summaries.',
                turn: 19,
              },
              { text: 'Surface moments explicitly in week one.', turn: 26 },
            ],
          },
        ],
      },
      recruitingInterview: {
        title: 'No candidate on this call',
        overview:
          'A customer onboarding check-in with a customer-side participant. No candidate, no role, nothing to assess against a hiring bar, so this template is deliberately left empty.',
        sections: [
          {
            title: 'Why this template does not apply',
            items: [
              {
                text: 'The external participant is a customer contact a week into using the product.',
                turn: 0,
              },
              {
                text: 'No role, competency, or hiring topic is discussed.',
                turn: 0,
              },
            ],
          },
          {
            title: 'What was discussed instead',
            items: [
              {
                text: 'Import friction, adoption drivers, and a disclosed reliability defect.',
                turn: 3,
              },
            ],
          },
        ],
      },
    },
    actions: [
      {
        task: 'Send Brightwell the duplicate-clearing steps and flag internally that it should not need steps',
        owner: 'Hannah Cole',
        timing: 'Today',
        turn: 15,
      },
      {
        task: 'Add a duplicate upload check ahead of the import progress indicator',
        owner: 'Mateo Ruiz',
        timing: 'Guided import work',
        turn: 12,
      },
      {
        task: 'Show rows processed out of rows total during import, prioritising movement over accuracy',
        owner: 'Mateo Ruiz',
        timing: 'Guided import work',
        turn: 8,
      },
      {
        task: 'Move transcript search to the front of the onboarding sequence and surface moments in week one',
        owner: 'Hannah Cole',
        timing: 'Next onboarding revision',
        turn: 19,
      },
      {
        task: 'Send the written note naming the week the reliability fix lands',
        owner: 'Hannah Cole',
        timing: 'This week',
        turn: 28,
      },
    ],
    moments: [
      {
        title: 'A spinner for four minutes reads as broken',
        note: 'Exact words. Use this in the guided import brief.',
        turn: 5,
      },
      {
        title: 'Search is what made them adopt',
        note: 'We lead onboarding with the wrong feature.',
        turn: 17,
      },
      {
        title: 'Template honesty earned trust',
        note: 'Validates the most argued-about decision in the feature.',
        turn: 22,
      },
    ],
    share: true,
  },
  {
    key: 'design-critique',
    title: 'Design critique — notetaker live view',
    filename: 'design-critique-live-view.mp4',
    source: 'browser',
    daysAgo: 15,
    hour: 15,
    durationSeconds: 1452,
    speakers: speakers('mateo', 'ada', 'yuki', 'grace'),
    turns: [
      [
        'mateo',
        'This is the live view while a notetaker is in a call. Five states: scheduled, joining, waiting room, recording, processing. I want to argue about the waiting room one specifically.',
      ],
      ['ada', 'Why that one?'],
      [
        'mateo',
        "Because it's the only state where the user has to do something, and right now it looks like the other four. It says 'waiting to be admitted' in the same grey as everything else.",
      ],
      [
        'yuki',
        'In testing, three of five people missed it entirely. They sat watching a screen that was politely telling them their bot was stuck outside the door.',
      ],
      [
        'grace',
        "On Google Meet a guest bot always needs admitting, so that's not an edge case, that's most calls.",
      ],
      [
        'mateo',
        "So my proposal is that waiting room is the one state that's loud. Colour, and the instruction as the headline rather than the status.",
      ],
      ['ada', "What's the instruction?"],
      [
        'mateo',
        "'Admit Fathom Clone Notetaker in your meeting.' Not 'waiting room'. The thing they need to do, in the words they'll see in Meet.",
      ],
      [
        'ada',
        "That's right. The status is for us, the instruction is for them.",
      ],
      [
        'yuki',
        "I'd go further and say the elapsed time matters. 'Waiting 40 seconds' is different from 'waiting 4 minutes'. At four minutes nobody is going to admit it and they should stop and start again.",
      ],
      [
        'mateo',
        "So after a couple of minutes the state changes meaning. It stops being 'waiting' and becomes 'this probably isn't happening'.",
      ],
      [
        'grace',
        'Technically I can tell you that after about five minutes Recall gives up anyway, so the UI should get there before the backend does.',
      ],
      [
        'mateo',
        "Then I'll add a third thing at two minutes: the instruction plus a way out. Stop and record from this browser instead.",
      ],
      [
        'ada',
        "That's good, because the fallback is better than nothing and nobody would find it on their own at that moment.",
      ],
      [
        'yuki',
        "Can I raise the recording state? The highlight button is in the right place but the feedback is too quiet. People clicked it twice because they couldn't tell it had worked.",
      ],
      ['mateo', 'What would be enough?'],
      [
        'yuki',
        "A count. 'Highlight 3 saved' rather than a flash. The count also tells them the earlier ones are still there, which the flash doesn't.",
      ],
      ['mateo', "Agreed, and it's cheaper than what I'd drawn."],
      [
        'ada',
        "What about processing? That's the state people see for longest.",
      ],
      [
        'mateo',
        "Processing is where I'd most like to do less. I had a progress bar, and I want to remove it, because it's only honest about the transcription half and then it sits at ninety percent during analysis.",
      ],
      [
        'grace',
        "It does genuinely sit at ninety. That's not a design problem, that's our pipeline having two stages of unequal length.",
      ],
      [
        'mateo',
        "So I'd rather say what's happening in words. 'Transcribing' then 'Writing notes'. Two honest states instead of one dishonest number.",
      ],
      [
        'yuki',
        'That tests better in my experience. A bar at ninety for two minutes makes people reload.',
      ],
      [
        'ada',
        'Do it. And the same principle as the import conversation with Brightwell, interestingly. Moving beats accurate there, honest beats precise here.',
      ],
      [
        'mateo',
        "They're both the same rule really. Don't imply more certainty than you have.",
      ],
      [
        'ada',
        "That's the line. Can you put it in the design notes so it outlives this meeting?",
      ],
    ],
    templates: {
      general: {
        title:
          'Waiting room becomes the one loud state; processing drops its progress bar',
        overview:
          'Four states of the notetaker live view are deliberately quiet and one is not: the waiting room is the only state requiring user action, and three of five test participants missed it. Processing loses its progress bar in favour of two honest named stages, on the principle that the UI should not imply more certainty than it has.',
        sections: [
          {
            title: 'Decisions',
            items: [
              {
                text: 'Waiting room becomes the only loud state, with the instruction as the headline rather than the status.',
                turn: 5,
              },
              {
                text: 'The headline uses the words the user sees in Meet: admit Fathom Clone Notetaker in your meeting.',
                turn: 7,
              },
              {
                text: 'After two minutes the state changes meaning and offers browser recording as a way out, ahead of the five minute backend timeout.',
                turn: 12,
              },
              {
                text: 'The progress bar is removed from processing in favour of two named stages, transcribing then writing notes.',
                turn: 21,
              },
            ],
          },
          {
            title: 'Evidence behind them',
            items: [
              {
                text: 'Three of five test participants missed the waiting room state entirely.',
                turn: 3,
              },
              {
                text: 'A guest bot always needs admitting on Google Meet, so this is most calls rather than an edge case.',
                turn: 4,
              },
              {
                text: 'The progress bar genuinely stalls at ninety percent because the two pipeline stages are of unequal length.',
                turn: 20,
              },
              {
                text: 'Users clicked highlight twice because a flash did not confirm the first click; a running count fixes both the confirmation and the history.',
                turn: 16,
              },
            ],
          },
        ],
      },
      salesCustomer: {
        title: 'Not a customer call',
        overview:
          'An internal design critique with no customer present. There is no opportunity, pricing, or commercial next step, so this template is left empty rather than populated by inference.',
        sections: [
          {
            title: 'Why this template does not apply',
            items: [
              {
                text: 'All four participants are colleagues reviewing an interface.',
                turn: 0,
              },
              {
                text: 'No customer, pricing, or procurement topic appears.',
                turn: 0,
              },
            ],
          },
          {
            title: 'Indirect customer evidence used',
            items: [
              {
                text: 'A principle from the Brightwell onboarding call was carried across: moving beats accurate, honest beats precise.',
                turn: 23,
              },
            ],
          },
        ],
      },
      recruitingInterview: {
        title: 'No candidate on this call',
        overview:
          'An internal design critique between four colleagues. No candidate, no role, no assessment, so this template is intentionally empty.',
        sections: [
          {
            title: 'Why this template does not apply',
            items: [
              { text: 'All participants are existing colleagues.', turn: 0 },
              { text: 'No hiring or assessment topic is discussed.', turn: 0 },
            ],
          },
          {
            title: 'Observable team signals',
            items: [
              {
                text: 'The designer argued for removing his own progress bar rather than defending it.',
                turn: 19,
              },
              {
                text: 'QA evidence from five participants changed two decisions in one session.',
                turn: 3,
              },
            ],
          },
        ],
      },
    },
    actions: [
      {
        task: 'Make waiting room the single loud state, with the admit instruction as the headline',
        owner: 'Mateo Ruiz',
        timing: 'This sprint',
        turn: 5,
      },
      {
        task: 'Add a two minute escalation offering browser recording as a way out of the waiting room',
        owner: 'Mateo Ruiz',
        timing: 'This sprint',
        turn: 12,
      },
      {
        task: 'Replace the highlight flash with a running saved count',
        owner: 'Mateo Ruiz',
        timing: 'This sprint',
        turn: 16,
      },
      {
        task: 'Replace the processing progress bar with two named stages, transcribing then writing notes',
        owner: 'Mateo Ruiz',
        timing: 'This sprint',
        turn: 21,
      },
      {
        task: 'Write the certainty principle into the design notes so it outlives the meeting',
        owner: 'Mateo Ruiz',
        timing: 'This week',
        turn: 25,
      },
    ],
    moments: [
      {
        title: 'The status is for us, the instruction is for them',
        note: 'Ada. Reusable beyond this screen.',
        turn: 8,
      },
      {
        title: 'Two honest states instead of one dishonest number',
        note: 'Why the progress bar goes.',
        turn: 21,
      },
    ],
    share: false,
  },
  {
    key: 'weekly-sync',
    title: 'Weekly product sync',
    filename: 'weekly-product-sync.mp4',
    source: 'notetaker',
    daysAgo: 1,
    hour: 9,
    durationSeconds: 1931,
    speakers: speakers(
      'ada',
      'grace',
      'mateo',
      'priya',
      'hannah',
      'daniel',
      'yuki',
    ),
    turns: [
      [
        'ada',
        "Short one today. Status on the ingest work, then anything that's become blocked since Friday.",
      ],
      [
        'daniel',
        "Load test is done and it reproduces Tuesday reliably. It took two days as estimated. It also found something I wasn't looking for.",
      ],
      ['grace', 'Go on.'],
      [
        'daniel',
        "The redelivery storm is worse at higher concurrency than linear. At double the load it's about five times the redeliveries, because each retry adds pressure to the thing that's already struggling.",
      ],
      ['priya', "So it's a feedback loop, not just a bottleneck."],
      [
        'daniel',
        "Right. Which means the two to four percent figure is only true for the load we happen to have. A busy quarter would be much worse, and we'd have read it as a sudden new problem.",
      ],
      [
        'ada',
        "That's worth saying out loud to Tom before he commits anything to Acme.",
      ],
      [
        'grace',
        "I'll do it today. It strengthens the case for holding the commitment rather than weakening it.",
      ],
      [
        'priya',
        "Side channel is up in crude form. Counter and timestamp, separate store, nothing shared. The ack-rate alert fires at sixty seconds below floor and I've tested it against the load test.",
      ],
      [
        'priya',
        'First thing it told us is that we had two smaller events last week that nobody noticed. Three minutes and five minutes.',
      ],
      [
        'hannah',
        "No tickets for either, so customers didn't see them. Or didn't mention them.",
      ],
      ['ada', "Either way we now know. That's the point of it."],
      [
        'grace',
        "Writer work starts today. Daniel and I are pairing on it rather than splitting, because the transaction boundaries aren't separable into two tasks.",
      ],
      [
        'mateo',
        'Guided import: duplicate check is in, progress count is half done. The duplicate check caught a real double upload in staging on its first day.',
      ],
      [
        'hannah',
        'I sent Brightwell the three causes and the weeks. Elena replied within the hour and said it was the first time a vendor had told her what actually broke.',
      ],
      ['ada', 'Good. Anything blocked?'],
      [
        'mateo',
        "Slightly. The progress count needs row totals from the import parser and the parser doesn't currently report them. It's a small change but it's in Daniel's area and Daniel is on the writer.",
      ],
      [
        'daniel',
        "Give me the specifics and I'll do it tonight. It's a counter, not a project.",
      ],
      [
        'grace',
        "I'd rather you didn't do it tonight. Put it on tomorrow morning, before the writer, and let the writer start after lunch. I don't want evening work on the file we're all worried about.",
      ],
      ['daniel', 'Fair.'],
      [
        'yuki',
        "One thing from me on the done criteria. I want to add the load test result to them. Not just seven quiet days in production, but the load test passing at double the old peak, since Daniel's found it's non-linear.",
      ],
      [
        'grace',
        "Agreed, and that's a real tightening rather than a formality.",
      ],
      [
        'ada',
        "Then that's the week. The non-linear finding is the headline and I'll put it in the written update.",
      ],
    ],
    templates: {
      general: {
        title: 'Load test found the redelivery storm is non-linear',
        overview:
          'The ingest work is on schedule and the load test, built first, has already changed the picture: redeliveries grow faster than load because each retry adds pressure to the struggling writer. The two to four percent loss figure is therefore specific to current traffic. The independent metrics path surfaced two previously unnoticed events in its first week.',
        sections: [
          {
            title: 'Progress',
            items: [
              {
                text: 'Load test complete in the estimated two days and reproduces the Tuesday spike reliably.',
                turn: 1,
              },
              {
                text: 'Crude side channel live with the ack-rate alert tested against the load test.',
                turn: 8,
              },
              {
                text: 'Writer work starts today, paired rather than split, because the transaction boundaries are not separable.',
                turn: 12,
              },
              {
                text: 'Guided import duplicate check shipped and caught a real double upload in staging on day one.',
                turn: 13,
              },
            ],
          },
          {
            title: 'New findings',
            items: [
              {
                text: 'Redeliveries scale non-linearly: double the load gives roughly five times the redeliveries, because retries feed the pressure.',
                turn: 3,
              },
              {
                text: 'The two to four percent loss figure only holds at current load, so a busy quarter would have looked like a brand new problem.',
                turn: 5,
              },
              {
                text: 'The new metrics path revealed two unnoticed degradations last week, of three and five minutes, with no tickets.',
                turn: 9,
              },
            ],
          },
          {
            title: 'Decisions',
            items: [
              {
                text: 'Done criteria tightened to include the load test passing at double the old peak, not just seven quiet days.',
                turn: 20,
              },
              {
                text: 'Sales is told about the non-linearity today, which strengthens the case for holding the Acme commitment.',
                turn: 7,
              },
              {
                text: 'The parser row-count change moves to tomorrow morning rather than tonight, to keep evening work off the writer.',
                turn: 18,
              },
            ],
          },
        ],
      },
      salesCustomer: {
        title: 'The non-linear finding affects what sales can commit to',
        overview:
          'No customer attended. Two customer-facing consequences came out of it: the accuracy figure sales was preparing to commit to is load-dependent, and Brightwell responded notably well to being told what actually broke.',
        sections: [
          {
            title: 'Impact on open deals',
            items: [
              {
                text: 'The accuracy figure holds only at current load, so sales is briefed before anything is committed to Acme.',
                turn: 6,
              },
              {
                text: 'The finding strengthens rather than weakens the case for holding the commitment until the window closes.',
                turn: 7,
              },
            ],
          },
          {
            title: 'Customer response',
            items: [
              {
                text: 'Brightwell replied within the hour saying it was the first time a vendor had told her what actually broke.',
                turn: 14,
              },
            ],
          },
          {
            title: 'Not covered on this call',
            items: [
              {
                text: 'No pricing, procurement, or commercial next step; this was an internal status sync.',
                turn: 0,
              },
            ],
          },
        ],
      },
      recruitingInterview: {
        title: 'No candidate on this call',
        overview:
          'An internal weekly status sync. No candidate, no role, no assessment, so this template is intentionally empty.',
        sections: [
          {
            title: 'Why this template does not apply',
            items: [
              {
                text: 'All participants are existing colleagues giving status.',
                turn: 0,
              },
              { text: 'No hiring topic appears in the transcript.', turn: 0 },
            ],
          },
          {
            title: 'Observable team signals',
            items: [
              {
                text: 'An engineering lead refused offered evening work on the riskiest file and rescheduled it.',
                turn: 18,
              },
              {
                text: 'QA tightened the success criteria mid-project in response to a new finding.',
                turn: 20,
              },
            ],
          },
        ],
      },
    },
    actions: [
      {
        task: 'Brief sales on the non-linear redelivery finding before anything is committed to Acme',
        owner: 'Grace Lindqvist',
        timing: 'Today',
        turn: 7,
      },
      {
        task: 'Add row totals to the import parser, tomorrow morning rather than tonight',
        owner: 'Daniel Osei',
        timing: 'Tomorrow morning',
        turn: 18,
      },
      {
        task: 'Add the load test passing at double the old peak to the done criteria',
        owner: 'Yuki Tanaka',
        timing: 'This week',
        turn: 20,
      },
      {
        task: 'Put the non-linear finding in the written weekly update',
        owner: 'Ada Okafor',
        timing: 'Today',
        turn: 22,
      },
    ],
    moments: [
      {
        title: 'Redeliveries are non-linear',
        note: 'Changes the accuracy number we can promise. Headline of the week.',
        turn: 3,
      },
      {
        title: 'Two events nobody noticed',
        note: 'The side channel earning its keep in week one.',
        turn: 9,
      },
    ],
    share: false,
  },
  {
    key: 'one-on-one',
    title: '1:1 — Grace',
    filename: 'one-on-one-grace.mp4',
    source: 'browser',
    daysAgo: 3,
    hour: 17,
    durationSeconds: 1104,
    speakers: speakers('ada', 'grace'),
    turns: [
      [
        'ada',
        "How are you finding the quarter now that it's one theme instead of three?",
      ],
      [
        'grace',
        "Better than I expected and I want to be careful about why. It's not that the work is easier. It's that I'm not deciding every day which of three things to disappoint someone about.",
      ],
      [
        'ada',
        "That's the thing I most wanted the cut to do and I wasn't sure it would.",
      ],
      [
        'grace',
        'The part that actually helped was cutting one rather than reordering. Reordering moves the decision to next month. Cutting ends it.',
      ],
      ['ada', "I'll remember that. What's worrying you?"],
      [
        'grace',
        "The writer. Not the four weeks, the thing after. Daniel's load test found the problem is non-linear, which means it's been getting worse as we've grown and we read it as noise. I'm now wondering what else we've read as noise.",
      ],
      ['ada', 'Is that a this-quarter question or a next-quarter one?'],
      [
        'grace',
        "Next quarter, but I'd like to not discover it in week eleven again. I think there's a piece of work that's just 'look at the things we've been tolerating' and it doesn't have a home.",
      ],
      [
        'ada',
        "Write it down as a candidate theme for Q1 now, while you're annoyed about it. Those get framed better than the ones written in planning week.",
      ],
      ['grace', "I'll do that."],
      ['ada', 'Anything about the team rather than the work?'],
      [
        'grace',
        "Yuki. She changed my mind in the roadmap meeting and she was right, and I've thought about it since because I nearly talked over her. She's doing the most senior thinking in the room and she's the most junior person in it.",
      ],
      ['ada', 'What do you want to do about that?'],
      [
        'grace',
        "Give her the done criteria, which we did. But that was partly my idea to make a point, and I think the next thing should be hers to ask for rather than mine to award. So I'd like to tell her plainly what I saw and let her say what she wants.",
      ],
      ['ada', "That's better than a plan. When?"],
      ['grace', 'Her next one to one, Thursday.'],
      [
        'ada',
        'Good. And Daniel offering to work the evening, you turning it down. I noticed that.',
      ],
      [
        'grace',
        "He'd have done it well and then done it again next week. The file we're in is not a tired-person file.",
      ],
      [
        'ada',
        "Agreed. Last thing from me: what do you need from me that you're not getting?",
      ],
      [
        'grace',
        "Keep the quarter at one theme. The pressure to add something back will come in about three weeks and it won't come from you, it'll come through you.",
      ],
      [
        'ada',
        "It will. I'll hold it, and if I can't I'll tell you before it's decided rather than after.",
      ],
    ],
    templates: {
      general: {
        title:
          'One theme is working; two follow-ups on growth and tolerated problems',
        overview:
          'A one to one on the effect of cutting the quarter to a single theme. The relief came from ending a decision rather than reordering it. Two follow-ups: a candidate Q1 theme to re-examine problems long read as noise, and a direct conversation with a junior engineer whose judgement is outpacing her level.',
        sections: [
          {
            title: 'What is working',
            items: [
              {
                text: 'One theme removed the daily decision about which of three things to disappoint someone over.',
                turn: 1,
              },
              {
                text: 'Cutting rather than reordering is what ended the decision, instead of moving it to next month.',
                turn: 3,
              },
            ],
          },
          {
            title: 'Concerns raised',
            items: [
              {
                text: 'The non-linear finding implies the problem had been worsening with growth and was read as noise, raising what else has been.',
                turn: 5,
              },
              {
                text: 'No home exists for work that re-examines long-tolerated problems; it is a candidate Q1 theme.',
                turn: 7,
              },
              {
                text: 'Pressure to add a second theme is expected in about three weeks and will arrive through rather than from the manager.',
                turn: 19,
              },
            ],
          },
          {
            title: 'People',
            items: [
              {
                text: 'The most senior thinking in the roadmap meeting came from the most junior person in it.',
                turn: 11,
              },
              {
                text: 'The next step will be hers to ask for rather than awarded, via a plain conversation on Thursday.',
                turn: 13,
              },
              {
                text: 'An offer of evening work on the riskiest file was declined deliberately.',
                turn: 17,
              },
            ],
          },
        ],
      },
      salesCustomer: {
        title: 'Not a customer call',
        overview:
          'A private one to one between a manager and an engineering lead. No customer, no opportunity, no commercial content, so this template is left empty rather than populated by inference.',
        sections: [
          {
            title: 'Why this template does not apply',
            items: [
              {
                text: 'Both participants are colleagues; the conversation is about team and workload.',
                turn: 0,
              },
              { text: 'No customer, pricing, or deal is discussed.', turn: 0 },
            ],
          },
          {
            title: 'Nearest commercial link',
            items: [
              {
                text: 'The non-linear reliability finding, which does affect customer commitments, is discussed only as an internal concern.',
                turn: 5,
              },
            ],
          },
        ],
      },
      recruitingInterview: {
        title: 'Not an interview, but it contains a progression discussion',
        overview:
          'No candidate and no hiring decision, so the interview structure does not apply. The call does contain an internal progression discussion about an existing engineer, which is the closest material and is reported as such rather than scored against a hiring bar.',
        sections: [
          {
            title: 'Why this template does not apply',
            items: [
              {
                text: 'Both participants are employees; no candidate is present and no role is open in this conversation.',
                turn: 0,
              },
              {
                text: 'No assessment against a hiring bar took place.',
                turn: 0,
              },
            ],
          },
          {
            title: 'Internal progression discussion',
            items: [
              {
                text: 'A junior QA engineer was identified as doing the most senior thinking in a recent eight person meeting.',
                turn: 11,
              },
              {
                text: 'Ownership of the quarter’s success criteria was already given to her.',
                turn: 13,
              },
              {
                text: 'The deliberate choice is to describe what was observed and let her state what she wants, rather than award a next step.',
                turn: 13,
              },
            ],
          },
        ],
      },
    },
    actions: [
      {
        task: 'Write up "re-examine what we have been tolerating" as a candidate Q1 theme while the annoyance is fresh',
        owner: 'Grace Lindqvist',
        timing: 'This week',
        turn: 8,
      },
      {
        task: 'Tell Yuki plainly what was observed in the roadmap meeting and let her say what she wants next',
        owner: 'Grace Lindqvist',
        timing: 'Thursday one to one',
        turn: 15,
      },
      {
        task: 'Hold the quarter at one theme, and flag any pressure to add before it is decided rather than after',
        owner: 'Ada Okafor',
        timing: 'Ongoing',
        turn: 20,
      },
    ],
    moments: [
      {
        title: 'Cutting ends the decision, reordering moves it',
        note: 'The clearest argument for how we plan. Keep.',
        turn: 3,
      },
      {
        title: 'Most senior thinking, most junior person',
        note: 'Grace on Yuki. Follow up after Thursday.',
        turn: 11,
      },
    ],
    share: false,
  },
];

const templateMeta = {
  general: {
    key: 'general',
    label: 'General',
    descriptor: 'Decisions, context, and next steps',
  },
  salesCustomer: {
    key: 'sales-customer',
    label: 'Sales / Customer',
    descriptor: 'Objections, buying process, and account risk',
  },
  recruitingInterview: {
    key: 'recruiting-interview',
    label: 'Recruiting / Interview',
    descriptor: 'Signals, evidence, and the hiring decision',
  },
};

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Turns authored dialogue into transcript segments. Each turn lasts as long as
 * it takes to say; whatever time is left over is spread between turns as
 * pauses, so a 62 minute call reads as 62 minutes rather than bunching at the
 * start. Spoken time is compressed only if the authored text genuinely will not
 * fit, which the tests assert does not happen.
 */
export function buildSegments(turns, duration) {
  const spoken = turns.map(([, text]) =>
    Math.max(MIN_SEGMENT_SECONDS, wordCount(text) / WORDS_PER_SECOND),
  );
  const totalSpoken = spoken.reduce((sum, value) => sum + value, 0);
  const totalPause = MIN_PAUSE_SECONDS * turns.length;
  // Never exceed the recording: compress speech if the text overruns.
  const scale = Math.min(1, (duration - totalPause) / totalSpoken);
  const slack = Math.max(
    MIN_PAUSE_SECONDS,
    (duration - totalSpoken * scale) / turns.length,
  );
  let cursor = 0;
  return turns.map(([speakerId, text], index) => {
    const start = Math.min(cursor, duration - 0.01);
    const end = Math.min(duration, start + spoken[index] * scale);
    cursor = end + slack;
    return {
      id: `seg-${index + 1}`,
      speakerId,
      start: round(start),
      end: round(Math.max(end, start + 0.01)),
      paragraphs: [text],
    };
  });
}

function sourced(items, segments) {
  return items.map((item) => ({
    text: item.text,
    source: segments[Math.min(item.turn, segments.length - 1)].start,
  }));
}

/** The seed library, with every timing and citation resolved. */
export function buildSeedMeetings(now = new Date()) {
  return meetings.map((meeting) => {
    const segments = buildSegments(meeting.turns, meeting.durationSeconds);
    const createdAt = new Date(now);
    createdAt.setUTCDate(createdAt.getUTCDate() - meeting.daysAgo);
    createdAt.setUTCHours(meeting.hour, 7, 0, 0);
    const templates = Object.entries(templateMeta).map(([name, meta]) => {
      const authored = meeting.templates[name];
      return {
        ...meta,
        title: authored.title,
        overview: authored.overview,
        sections: authored.sections.map((section) => ({
          title: section.title,
          items: sourced(section.items, segments),
        })),
      };
    });
    return {
      key: meeting.key,
      title: meeting.title,
      filename: meeting.filename,
      source: meeting.source,
      mediaType: 'audio/wav',
      durationSeconds: meeting.durationSeconds,
      createdAt: createdAt.toISOString(),
      speakerNames: meeting.speakers,
      share: meeting.share,
      segments,
      intelligence: {
        provenance: 'generated',
        templates,
        actions: meeting.actions.map((action, index) => ({
          id: `action-${index + 1}`,
          task: action.task,
          owner: action.owner,
          timing: action.timing,
          source: segments[Math.min(action.turn, segments.length - 1)].start,
        })),
      },
      moments: meeting.moments.map((moment) => {
        const segment = segments[Math.min(moment.turn, segments.length - 1)];
        const start = segment.start;
        const end = Math.min(
          meeting.durationSeconds,
          Math.min(segment.end, start + 45),
        );
        return {
          title: moment.title,
          note: moment.note,
          startMs: Math.round(start * 1000),
          endMs: Math.round(Math.max(end, start + 1) * 1000),
        };
      }),
    };
  });
}
