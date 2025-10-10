# Commit Message Guidelines

## Format
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

## Types
- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools

## Examples
```
feat(player): add volume control functionality

fix(auth): resolve Spotify token expiration issue

docs(readme): update installation instructions

style(ui): improve button hover states

refactor(api): optimize Spotify API calls

perf(player): reduce memory usage in audio playback

test(components): add unit tests for Player component

chore(deps): update React to version 18.2.0
```

## Best Practices
- Use imperative mood ("add" not "added")
- Keep first line under 50 characters
- Capitalize first letter
- No period at the end of the subject line
- Use body to explain what and why, not how
