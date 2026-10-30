PROJECT COMEBACK

Vision, Principles & Master Roadmap

Project status: Active development — Gym Comeback
Long-term vision: A family of personalised applications that help people prepare for the activities and experiences they want to pursue.

Guiding principle: NO STEREOTYPES. WHOOP WHOOP!

---

1. Our Vision

Project Comeback aims to help people prepare for meaningful personal goals through personalised, adaptive programmes.

The goal is not to create another collection of generic fitness and activity applications.

We want to build tools that understand the individual, recognise their starting point, respond to their progress, and help them work towards their chosen goals.

For one person, that might mean returning to the gym.

For another, it might mean preparing for overnight hiking, a four-week canoe expedition, or another challenging hobby.

The activities will differ, but the underlying philosophy remains consistent.

«Build for the individual. Adapt to the person. Never assume their potential.»

Our first product: Gym Comeback

Gym Comeback is the first application in the Project Comeback vision.

Its immediate purpose is to provide an accessible, personalised training experience that adapts to the individual rather than forcing everyone into the same programme.

We will establish a reliable, useful product before expanding into other applications.

---

2. Our Foundational Principle: No Stereotypes

Personalisation must be based on the individual, not assumptions about the group they belong to.

This principle applies to every application in the Project Comeback family.

Individual ability

Age, gender, body size, nationality, language, disability and cultural background must not be used as simplistic substitutes for understanding an individual's abilities, goals or potential.

Relevant health considerations, recovery needs and personal circumstances should be considered appropriately, without defining the person by them.

Individual goals

We ask people what they want to achieve instead of assuming their priorities.

Individual progression

Programmes respond to demonstrated performance, feedback, circumstances and appropriate safety boundaries.

Individual experience

Users should be able to access clear instructions and useful coaching in their preferred language, where supported.

Equal quality of support

Language selection or cultural background should not result in inferior coaching, less useful recommendations or reduced access to important safety information.

Personalisation comes from understanding the person, not stereotyping the population.

---

3. Development Principles

All Project Comeback products should follow these principles.

3.1 Personalisation over generic programming

A programme should reflect the individual's starting point, goals, circumstances and progress.

3.2 Adaptation over rigid schedules

Progression should be informed by actual results and feedback rather than arbitrary calendar-based increases.

3.3 Explainable recommendations

Users and coaches should be able to understand why a programme or recommendation has changed.

3.4 Safety within defined boundaries

Adaptation must respect relevant limitations and safety rules. The system should not treat every reported symptom as something to push through or allow an automated recommendation to replace appropriate professional judgement.

3.5 Accessible and inclusive design

Applications should accommodate different languages, experiences, abilities, equipment and user preferences wherever practical.

3.6 Protect working functionality

New features must not come at the expense of established functionality.

Development should use known-good versions, regression testing, version identification and recoverable backups.

3.7 Reuse where it makes sense

Shared components may be reused across applications, but activities with fundamentally different requirements must retain their own specialised logic.

We will not force every application into an unnecessarily complicated, one-size-fits-all architecture.

---

4. Roadmap A — Gym Comeback

Priority: Immediate

Gym Comeback is the active development project. Other opportunities must not distract from stabilising and improving this application.

Stage 1: Stabilisation and reliability

- Use the last confirmed stable release as the development baseline.
- Resolve the workout-plan issue identified during the V19.2 testing cycle.
- Verify weekly carry-forward of weights and repetitions for weighted and non-weighted exercises.
- Check that exercise selection and programme settings remain correct.
- Preserve established functionality.
- Improve version verification and update reliability.
- Maintain a clear record of tested and untested releases.

Completion criteria: The user has verified that the programme displays the expected exercises, weekly values behave correctly, and established features continue to work.

Stage 2: Improve the adaptive training engine

- Improve performance-based progression.
- Incorporate completed repetitions, loads, effort and relevant feedback.
- Improve exercise substitutions.
- Respect reported discomfort and relevant restrictions.
- Explain progression and modification recommendations.
- Avoid unnecessary or unpredictable programme changes.

Stage 3: Refine the training experience

- Continue improving workout logging.
- Improve progress tracking and visual feedback.
- Refine exercise instructions and equipment guidance.
- Improve mobile usability and accessibility.
- Address bugs before introducing major new features.

Stage 4: Prepare for future expansion

As appropriate, assess opportunities to separate reusable components from gym-specific functionality.

Potential areas include:

- Personal profiles and goals.
- Programme scheduling.
- Progress tracking.
- Adaptive decision-making.
- Feedback and recovery tracking.
- Data storage and backup.
- Language resources.

This is a gradual architectural consideration, not a requirement to rewrite the working application.

---

5. Roadmap B — Project Comeback Platform

Priority: Strategic planning

This roadmap runs alongside Gym Comeback but does not replace its immediate development priorities.

The objective is to determine which capabilities could support multiple standalone applications.

Stage 1: Define the shared foundations

Explore reusable components for:

- Personal profiles and goals.
- Programme and activity scheduling.
- Progress tracking.
- User feedback and readiness.
- Rules-based adaptation.
- Explainable recommendations.
- Data storage and backup.
- Accessibility and language preferences.

Stage 2: Separate shared capabilities from activity-specific logic

The shared foundation may handle common requirements, while each application defines its own methods of preparation and progression.

For example:

- Gym training uses exercise selection, sets, repetitions, loads and recovery.
- Hiking preparation uses walking distance, elevation, pack weight and consecutive hiking days.
- Canoe preparation uses paddling endurance, expedition duration, portages and trip-specific demands.

The applications must not assume that the same progression rules are suitable for every activity.

Stage 3: Validate the architecture through real products

Rather than building a large platform before it has been proven, introduce shared capabilities incrementally.

Hiking Comeback may provide the first opportunity to test whether the architecture can support an activity substantially different from gym training.

---

6. Roadmap C — Multilingual Support

Priority: Future development consideration

Language support should be considered during relevant architectural decisions, even before multiple languages are implemented.

Potential languages include:

- English
- Hindi
- Indonesian
- Simplified Chinese
- Traditional Chinese
- Afrikaans
- Spanish
- Arabic
- Other languages based on user demand

This is an exploratory list, not a commitment to implement every language.

Requirements to investigate

- User-selectable language preferences.
- Separation of interface text from application logic.
- Translated instructions and coaching explanations.
- Appropriate handling of different writing systems.
- Right-to-left interface support where required.
- Consistent safety messaging.
- Familiar exercise terminology alongside translated explanations where useful.
- Testing with fluent speakers and relevant subject-matter expertise.

The training engine should not change its underlying recommendation simply because the user selects a different language.

Translations must preserve meaning, particularly for exercise instructions, restrictions and safety-related information.

Market validation

Before prioritising individual languages, investigate user demand, existing competitors, translation quality requirements and the needs of the intended audience.

The objective is not merely to translate an application. It is to provide a high-quality personalised experience to people who prefer different languages.

---

7. Roadmap D — Coach and Group Training

Priority: Future product exploration

Project Comeback may eventually support personal trainers, CrossFit coaches, group-training facilities and gyms.

This capability may become a standalone product or a distinct product experience. No final product structure has been decided.

Potential users

- Personal trainers managing individual clients.
- CrossFit coaches prescribing workouts to a class.
- Group-training instructors.
- Gym owners managing training sessions and members.

Potential capabilities

Coach management

- Client and athlete profiles.
- Individual programme creation.
- Coach-created workout templates.
- Programme scheduling.
- Review of completed workouts.
- Client progression reports.

Group training

- Create one workout and assign it to a group.
- Allow each participant to record individual results.
- Support coach-prescribed scaling and modifications.
- Compare results where appropriate and with suitable permissions.
- Give coaches an overview of class participation and performance.

Flexible workout presentation

The gym should choose its preferred workflow.

Possible options include:

- A shared gym display.
- Individual phone-based workouts.
- A combination of shared displays and individual devices.

Coach oversight

The system should support coaching decisions without silently overriding the coach's prescribed workout.

Permitted exercise alternatives and scaling options should be appropriately controlled.

Privacy and access

Client and athlete records must be protected through appropriate permissions. Coaches should access only the information they are authorised to see.

Design principle

One workout may be shared by a group, but every athlete remains an individual.

---

8. Roadmap E — Hiking Comeback

Priority: Future standalone application

Hiking Comeback would help individuals prepare for overnight and multi-day hiking.

Potential capabilities include:

- Personalised hiking preparation plans.
- Progressive walking duration and distance.
- Hill and elevation preparation.
- Loaded-pack training.
- Strength and mobility preparation.
- Back-to-back hiking simulations.
- Equipment and skill checklists.
- Trip-specific preparation based on terrain, duration and expected demands.
- Readiness and recovery feedback.

A potential feature is a progressive real-world Pack Test, allowing users to record walking distance, duration, terrain, pack load, perceived effort, discomfort and subsequent recovery.

The application should support preparation and decision-making without pretending to replace appropriate route planning, weather assessment, navigation skills or emergency preparation.

---

9. Roadmap F — Canoe Comeback

Priority: Future standalone application

Canoe Comeback would help individuals prepare physically and practically for extended canoe adventures.

An eventual use case is preparation for a four-week expedition.

Potential capabilities include:

- Personalised paddling preparation.
- Aerobic endurance and strength training.
- Progressive paddling sessions.
- Portage preparation.
- Trip-specific conditioning.
- Equipment and food planning.
- Expedition simulation.
- Fatigue and recovery tracking.
- Planned versus actual daily distance.
- Paddling time, rest periods and trip notes.
- Itinerary and campsite planning.

Offline functionality would be an important design consideration for remote expeditions.

Navigation, weather, water conditions and emergency communication require suitable external information and equipment. The application must not be treated as a replacement for expedition planning or emergency systems.

---

10. Roadmap G — Additional Activities

Priority: Exploratory

Once the approach has been validated, consider other activity-specific applications.

Potential examples include:

- Cycling Comeback.
- Mountain Bike Comeback.
- Climbing Comeback.
- Trail Running Comeback.
- Motorcycle Touring Comeback.

These are possibilities rather than approved development commitments.

Each would require its own assessment of user needs, activity-specific progression, safety requirements and commercial viability.

---

11. Ideas and Experiments Register

New ideas should be recorded without automatically becoming development commitments.

Examples currently under consideration include:

- A comic-style personal avatar generated from an optional user-provided photograph.
- Additional personalisation options.
- Alternative coaching experiences.
- New activity-specific applications.
- Expanded language support.
- Coach and group-training functionality.

Ideas should be evaluated against the current priorities before being scheduled.

---

12. Release and Testing Policy

All active development must follow a controlled release process.

1. Start from a confirmed stable version.
2. Define the intended changes.
3. Build the release.
4. Run available technical checks.
5. Deliver the complete release package.
6. Have the user test it in the intended environment.
7. Record the outcome.
8. Preserve the last confirmed stable version.

A technically valid package is not automatically considered user-tested or deployed.

Release records must clearly distinguish:

- Built.
- Technically checked.
- Awaiting user testing.
- Passed by user testing.
- Deployed and verified.

No release should be described as successful until its relevant acceptance criteria have been met.

---

13. How We Prioritise Work

Every proposed feature should be considered against four questions:

1. Does it improve the current product or serve a validated future need?
2. Does it align with the No Stereotypes principle?
3. Can it be introduced without unnecessarily risking working functionality?
4. Is now the appropriate time to build it?

A feature may be valuable without being an immediate priority.

The default approach is to stabilise, improve and validate before expanding.

---

14. Project Status

At the time this document is established:

- Gym Comeback is the active development priority.
- V19.1 is the last confirmed stable baseline for the workout-plan and weekly carry-forward work.
- V19.2 has an unresolved workout-plan issue and must not be treated as a confirmed stable release.
- The broader Project Comeback platform, multilingual support, coach and group training, and future activity-specific applications remain planning items.
- No future application or language rollout is committed until its requirements and priorities have been evaluated.

This document records the strategic direction. It does not mean that planned features have been implemented.

---

Our Commitment

Project Comeback exists to help people prepare for the experiences they want to have.

We will build carefully, learn from real users, respect individual differences and protect the functionality we have already established.

We will not assume that everyone starts at the same point, wants the same outcome or follows the same path.

Understand the person. Respect their individuality. Adapt the programme. Never assume their potential.

NO STEREOTYPES. WHOOP WHOOP!# gym-comeback-app
Gym Return Workout Tracker
