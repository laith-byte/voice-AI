# STABILITY RULES — DO NOT VIOLATE

- Never create a new file without verifying all imports resolve
- Never modify an API route without updating every frontend caller
- Never change a database schema without migrating existing data
- After every change, run `npm run build` and fix any errors before moving on
- Do not mark a task as done until you've manually verified it works end-to-end
