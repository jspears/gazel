# Contributing to Gazel

Thank you for your interest in contributing to Gazel! We welcome contributions from the community.

## How to Contribute

### Reporting Issues

1. Check if the issue already exists
2. Create a new issue with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (OS, Node version, Bazel version)

### Suggesting Features

1. Open a discussion first to gauge interest
2. Provide use cases and examples
3. Consider how it fits with existing features

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test thoroughly
5. Commit with clear messages
6. Push to your fork
7. Open a pull request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/gazel
cd gazel

# Install dependencies
./setup.sh

# Start development
npm run dev
```

## Code Guidelines

### TypeScript
- Use TypeScript for all new code
- Add proper types (avoid `any`)
- Use meaningful variable names

### Style
- Follow existing code style
- Use camelCase for variables and functions
- Use PascalCase for components and types
- Keep functions small and focused

### Testing
- Test your changes with different Bazel workspaces
- Verify both happy path and error cases
- Check that existing features still work

### Documentation
- Update README if adding features
- Add JSDoc comments for complex functions
- Update TECHNICAL_DETAILS.md for architectural changes

## Commit Messages

Use clear, descriptive commit messages:
- `feat: add support for new Bazel rule type`
- `fix: correct query parsing for complex expressions`
- `docs: update installation instructions`
- `refactor: simplify target search logic`

## Questions?

Feel free to:
- Open an issue for questions
- Start a discussion for ideas
- Reach out to maintainers

Thank you for contributing!
