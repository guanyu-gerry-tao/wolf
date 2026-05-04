#!/usr/bin/env bash
set -euo pipefail

# Populates a v2 profile.toml through the public CLI surface. Acceptance cases
# use this instead of copying legacy profile.md/resume_pool.md fixtures into a
# workspace whose active profile source is now profile.toml.

if [ "$#" -ne 2 ]; then
  echo "usage: bash test/fixtures/wolf-profile/scripts/populate_v2_profile.sh <persona> <workspace>" >&2
  echo "personas: ng-swe, swe-mid, swe-mid-no-education, swe-mid-reordered" >&2
  exit 2
fi

PERSONA="$1"
WS="$2"

run_wolf() {
  WOLF_DEV_HOME="$WS" npm_config_loglevel=silent npm run wolf -- "$@"
}

set_common_questions() {
  run_wolf profile set question.authorized_to_work.answer "Yes, I am legally authorized to work in the United States."
  run_wolf profile set question.require_sponsorship.answer "$1"
  run_wolf profile set question.willing_to_relocate.answer "$2"
  run_wolf profile set question.salary_expectation.answer "$3"
}

add_ng_swe() {
  run_wolf profile set identity.legal_first_name "Avery"
  run_wolf profile set identity.legal_last_name "Chen"
  run_wolf profile set identity.country_of_citizenship "China"
  run_wolf profile set contact.email "avery.chen@example.test"
  run_wolf profile set contact.phone "+1 555 020 1142"
  run_wolf profile set address.full "4321 University Ave, Berkeley, CA 94704, USA"
  run_wolf profile set links.first "https://www.linkedin.com/in/avery-chen-example"
  run_wolf profile set links.second "https://github.com/avery-chen-example"
  run_wolf profile set links.others "https://leetcode.com/avery-chen-example"
  run_wolf profile set job_preferences.target_roles $'Software Engineer\nBackend Engineer\nFull Stack Engineer'
  run_wolf profile set job_preferences.target_locations $'SF Bay Area\nNew York City\nSeattle\nRemote-US'
  run_wolf profile set job_preferences.remote_preference "hybrid or remote preferred"
  run_wolf profile set job_preferences.relocation_preferences "Open to SF Bay Area, New York City, Seattle, and remote-friendly US roles."
  run_wolf profile set job_preferences.sponsorship_preferences "F-1 OPT now; will need H-1B sponsorship in the future."
  run_wolf profile set job_preferences.min_annual_salary_usd "120000"
  run_wolf profile set job_preferences.scoring_notes "Prioritize backend, data infrastructure, TypeScript, Go, Python, Postgres, Redis, Airflow, WebSocket, and gRPC roles."
  run_wolf profile set skills.text "TypeScript, Go, Python, SQL, Postgres, Redis, React, Node.js, Docker, AWS, Linux, Git, Airflow, WebSocket, gRPC"
  run_wolf profile set awards.items $'Dean\'s List, 2023\nICPC regional participant, 2022'

  run_wolf profile add experience --id acme-robotics-intern
  run_wolf profile set experience.acme-robotics-intern.job_title "Software Engineer Intern"
  run_wolf profile set experience.acme-robotics-intern.company "Acme Robotics"
  run_wolf profile set experience.acme-robotics-intern.start "2025-05"
  run_wolf profile set experience.acme-robotics-intern.end "2025-08"
  run_wolf profile set experience.acme-robotics-intern.location "San Jose, CA"
  run_wolf profile set experience.acme-robotics-intern.bullets $'Built TypeScript and Go services that streamed robot telemetry into Postgres and Redis for debugging dashboards.\nAdded WebSocket status updates for field operators, reducing manual log checks during test runs.\nWrote integration tests for REST and gRPC endpoints used by the operations dashboard.'

  run_wolf profile add experience --id lakeview-data-intern
  run_wolf profile set experience.lakeview-data-intern.job_title "Data Engineering Intern"
  run_wolf profile set experience.lakeview-data-intern.company "Lakeview Analytics"
  run_wolf profile set experience.lakeview-data-intern.start "2024-06"
  run_wolf profile set experience.lakeview-data-intern.end "2024-09"
  run_wolf profile set experience.lakeview-data-intern.location "Remote"
  run_wolf profile set experience.lakeview-data-intern.bullets $'Implemented Python Airflow tasks to normalize customer events before loading them into warehouse tables.\nImproved SQL checks for duplicate events and surfaced failures in CI runbooks.\nPartnered with senior engineers to document incident triage steps for failed backfills.'

  run_wolf profile add project --id course-scheduler
  run_wolf profile set project.course-scheduler.name "Course Scheduler"
  run_wolf profile set project.course-scheduler.year "2025"
  run_wolf profile set project.course-scheduler.tech_stack "TypeScript, React, Node.js, Postgres"
  run_wolf profile set project.course-scheduler.bullets $'Built a full-stack planning app with API endpoints for prerequisite checks and conflict detection.\nAdded searchable course metadata and saved-plan persistence backed by Postgres.'

  run_wolf profile add project --id realtime-chat-lab
  run_wolf profile set project.realtime-chat-lab.name "Realtime Chat Lab"
  run_wolf profile set project.realtime-chat-lab.year "2024"
  run_wolf profile set project.realtime-chat-lab.tech_stack "Go, WebSocket, Redis"
  run_wolf profile set project.realtime-chat-lab.bullets $'Implemented WebSocket fanout, Redis presence tracking, and load tests for concurrent chat rooms.\nWrote a short runbook for debugging stuck connections and reconnect storms.'

  run_wolf profile add education --id uc-berkeley-bs-cs
  run_wolf profile set education.uc-berkeley-bs-cs.degree "B.S. Computer Science"
  run_wolf profile set education.uc-berkeley-bs-cs.school "University of California, Berkeley"
  run_wolf profile set education.uc-berkeley-bs-cs.start "2021"
  run_wolf profile set education.uc-berkeley-bs-cs.end "2025"
  run_wolf profile set education.uc-berkeley-bs-cs.gpa "3.8/4.0"
  run_wolf profile set education.uc-berkeley-bs-cs.relevant_coursework "Distributed Systems, Databases, Operating Systems, Machine Learning"

  set_common_questions "Yes, I will require H-1B sponsorship after OPT." "Yes, for SF Bay Area, New York City, Seattle, and remote-friendly US roles." "USD 120,000 to USD 150,000 base depending on location and level."
}

add_swe_mid_core() {
  run_wolf profile set identity.legal_first_name "Jordan"
  run_wolf profile set identity.legal_last_name "Rivera"
  run_wolf profile set identity.country_of_citizenship "United States"
  run_wolf profile set contact.email "jordan.rivera@example.test"
  run_wolf profile set contact.phone "+1 555 020 7788"
  run_wolf profile set address.full "250 Market St, Denver, CO 80202, USA"
  run_wolf profile set links.first "https://www.linkedin.com/in/jordan-rivera-example"
  run_wolf profile set links.second "https://github.com/jordan-rivera-example"
  run_wolf profile set job_preferences.target_roles $'Senior Backend Engineer\nData Platform Engineer\nDistributed Systems Engineer'
  run_wolf profile set job_preferences.target_locations $'Denver\nAustin\nRemote-US'
  run_wolf profile set job_preferences.remote_preference "remote or hybrid"
  run_wolf profile set job_preferences.relocation_preferences "Prefer Denver, Austin, or remote US; open to relocation for a strong platform role."
  run_wolf profile set job_preferences.sponsorship_preferences "No sponsorship required."
  run_wolf profile set job_preferences.min_annual_salary_usd "165000"
  run_wolf profile set job_preferences.scoring_notes "Prioritize backend platform, Spark, Kafka, Postgres, distributed systems, and data reliability."
  run_wolf profile set skills.text "Java, Scala, Spark, Hadoop, Kafka, PostgreSQL, Snowflake, REST API design, distributed systems, Go"

  run_wolf profile add experience --id northwind-backend
  run_wolf profile set experience.northwind-backend.job_title "Backend Engineer"
  run_wolf profile set experience.northwind-backend.company "Northwind Systems"
  run_wolf profile set experience.northwind-backend.start "2022"
  run_wolf profile set experience.northwind-backend.end "2025"
  run_wolf profile set experience.northwind-backend.location "Denver, CO"
  run_wolf profile set experience.northwind-backend.bullets $'Built Java and Scala backend services running 200+ event-processing workflows.\nImproved Spark data pipelines used by analytics and operations teams; cut nightly batch runtime by 38%.\nDesigned internal REST APIs and on-call runbooks for distributed job processing.\nMigrated legacy Hadoop jobs to Spark Structured Streaming with zero data loss.'

  run_wolf profile add experience --id vega-platform
  run_wolf profile set experience.vega-platform.job_title "Data Platform Engineer"
  run_wolf profile set experience.vega-platform.company "Vega Logistics"
  run_wolf profile set experience.vega-platform.start "2020"
  run_wolf profile set experience.vega-platform.end "2022"
  run_wolf profile set experience.vega-platform.location "Austin, TX"
  run_wolf profile set experience.vega-platform.bullets $'Owned the streaming ingestion path on Kafka; sustained 12k events/sec at p99 under 80ms.\nBuilt a Postgres CDC pipeline replicating 40+ tables to a Snowflake warehouse.\nAuthored the team data-quality framework using Great Expectations and custom Scala validators.'

  run_wolf profile add experience --id atlas-intern
  run_wolf profile set experience.atlas-intern.job_title "Software Engineer Intern"
  run_wolf profile set experience.atlas-intern.company "Atlas Tools"
  run_wolf profile set experience.atlas-intern.start "2019"
  run_wolf profile set experience.atlas-intern.end "2019"
  run_wolf profile set experience.atlas-intern.location "Chicago, IL"
  run_wolf profile set experience.atlas-intern.bullets $'Built Java API integrations between internal reporting tools and a third-party billing system.\nWrote integration tests for batch processing endpoints; raised coverage from 41% to 78%.'

  run_wolf profile add project --id internal-job-scheduler
  run_wolf profile set project.internal-job-scheduler.name "Internal Job Scheduler"
  run_wolf profile set project.internal-job-scheduler.year "2024"
  run_wolf profile set project.internal-job-scheduler.tech_stack "Go, SQLite"
  run_wolf profile set project.internal-job-scheduler.bullets $'Built a lightweight cron replacement for ad-hoc team automations.\nReplaced four bespoke scripts and reduced on-call paging by about 30%.'

  run_wolf profile add project --id spark-connector
  run_wolf profile set project.spark-connector.name "Open-Source Spark Connector"
  run_wolf profile set project.spark-connector.year "2023"
  run_wolf profile set project.spark-connector.tech_stack "Spark, Scala"
  run_wolf profile set project.spark-connector.bullets $'Maintained a small Spark connector for an internal columnar format.\nShipped two minor releases used by three downstream teams.'

  set_common_questions "No sponsorship required." "Yes, for Denver, Austin, and remote US roles." "USD 165,000 to USD 210,000 base depending on scope and location."
}

add_swe_mid_education() {
  run_wolf profile add education --id northwind-state-bs-cs
  run_wolf profile set education.northwind-state-bs-cs.degree "B.S. Computer Science"
  run_wolf profile set education.northwind-state-bs-cs.school "Northwind State University"
  run_wolf profile set education.northwind-state-bs-cs.start "2015"
  run_wolf profile set education.northwind-state-bs-cs.end "2019"
}

case "$PERSONA" in
  ng-swe)
    add_ng_swe
    ;;
  swe-mid)
    add_swe_mid_core
    add_swe_mid_education
    ;;
  swe-mid-no-education)
    run_wolf profile set resume.section_order $'experience\nproject\nskills'
    add_swe_mid_core
    ;;
  swe-mid-reordered)
    run_wolf profile set resume.section_order $'skills\nproject\nexperience\neducation'
    add_swe_mid_core
    add_swe_mid_education
    ;;
  *)
    echo "unknown persona: $PERSONA" >&2
    echo "personas: ng-swe, swe-mid, swe-mid-no-education, swe-mid-reordered" >&2
    exit 2
    ;;
esac
