# User Stories — wolf

Target user 1: a CS student applying to software engineering internships or full-time roles, comfortable with the terminal.

Target user 2: a tech professional applying to software engineering roles, comfortable with the terminal but looking to save time and increase application quality.

Target user 3: a non-technical professional applying to roles in other industries, interested in leveraging AI to improve their job search (use MCP) under AI agent's help.

---

## US-01.1: Big picture

As a job seeker, I want a tool that can automate and optimize the job application process. I don't want to spend hours tailoring my resume, filling out forms, and sending outreach emails. I want a single tool to handle everything from discovering jobs to tracking applications, so that I can focus on preparing for interviews and improving my skills.

## US-01.2: Big picture, with technical skills

As a job seeker, I know that AI can help me with my job search, but I don't want to use a dozen different tools or write custom scripts. I want a command-line tool that integrates with the platforms I use (LinkedIn, Handshake, email alerts) and leverages AI to tailor my resume, generate cover letters, fill forms, and send outreach emails. I want it to be easy to set up and use, so that I can save time and increase my chances of landing interviews. However, I don't want AI overtaking too much of the process — I still want to have control and review everything before it goes out. I just want to automate the repetitive, time-consuming parts.

## US-01.3: Big picture, non-technical user

As a non-technical job seeker, I want to leverage AI to improve my job search, but I don't want to deal with complex tools or coding. I want a simple command-line interface that can handle everything from finding jobs to tailoring my resume and sending outreach emails. I want it to be easy to set up and use, so that I can save time and increase my chances of landing interviews. Mostly I only know how to chat with ChatGPT or Claude, so I want to be able to let my chatbot use those tools: while I chat with ChatGPT, it can handle the job search tasks for me in the background, and I can just review and approve everything before it goes out. 

## US-01.4: Big picture, CS student

As a CS student, I want to use my technical skills to automate my job search and gain an edge in the competitive software engineering job market. (except similar stories like non-technical user and technical user), I also want to be able to customize, extend, and contribute to the tool, since I have the skills to do so and want to be part of an open-source project that helps job seekers like me.

## US-02.1: Job discovery

As a job seeker, I want to easily discover relevant jobs. Right now, I have to check multiple platforms (LinkedIn, Handshake, email alerts) and manually copy-paste job listings into a spreadsheet to keep track of them. I want a tool that can automatically pull job listings from all my sources, deduplicate them, and present them in one place for me to review.

## US-02.2: Job discovery, current openclaw user

As a current OpenClaw user, I'm able to use OpenClaw to pull job listings from LinkedIn, Handshake, and email alerts, but it's a bit clunky, and OpenClaw use expensive API credits for this kind of task. I want a more efficient and user-friendly way to discover jobs that integrates with my existing workflow and doesn't require me to write custom prompts or scripts. It also needs to be structured enough, so each job application keeps consistent formatting and data fields, which makes it easier for me to review and manage my applications.

## US-02.3: Job discovery, non-technical user

As a non-technical job seeker, I want to be able to discover relevant jobs, and I wish to use automation to save time, but I don't want to deal with complex tools or coding. So I want to simply chat with my AI assistant (e.g. ChatGPT) and say "find me software engineering internships in San Francisco", and have it pull job listings from LinkedIn, Handshake, and email alerts for me.

## US-02.4: Job discovery, CS student

As a CS student, I'm actively searching internships from Handshake. I want an automated way to pull all the listings from Handshake under my supervision, so I don't have to spend hours browsing and copying them manually, and I don't have to use up my OpenClaw credits for this because it is expensive for a CS student like me. 

