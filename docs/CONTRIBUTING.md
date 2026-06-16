# Contributing to GameShop

We love your input! We want to make contributing to GameShop as easy and transparent as possible.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Development Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## Branch Naming

```
feature/description    — New features (feature/user-auth)
bugfix/description     — Bug fixes (bugfix/cart-total)
hotfix/description     — Production hotfixes
docs/description       — Documentation changes
refactor/description   — Code refactoring
```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add payment verification system
fix: fix cart total calculation
docs: update API documentation
style: format code with prettier
refactor: extract order service
test: add auth integration tests
chore: update dependencies
```

## Pull Request Process

1. **Create a feature branch** from `develop`
2. **Write clear commit messages** following the convention
3. **Write or update tests** for your changes
4. **Run all tests** and ensure they pass
5. **Update documentation** if needed
6. **Submit PR** to `develop` branch
7. **Request review** from maintainers

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests pass (`npm run test`)
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] No lint errors (`npm run lint`)
- [ ] Documentation updated
- [ ] Changes are backward compatible

## Code Style

### TypeScript / JavaScript

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Use async/await over callbacks
- Use const/let over var
- Use arrow functions for callbacks
- Export named exports over default exports

### Dart / Flutter

- Follow Dart's official style guide
- Use `const` constructors where possible
- Use `final` for immutable variables
- Use named constructors for clarity
- Use Provider for state management

### CSS / Styling

- Use Tailwind CSS utility classes
- Prefer shadcn/ui components
- Use CSS variables for theme values
- Follow responsive design patterns

## Testing Guidelines

### Backend Tests

```bash
# Unit tests
cd backend && npm run test

# Integration tests
npm run test:integration

# Coverage
npm run test:coverage
```

### Frontend Tests

```bash
cd frontend && npm run test
```

### Mobile Tests

```bash
cd mobile && flutter test
```

## Adding New Dependencies

- Get approval from maintainers for new dependencies
- Prefer well-maintained, popular packages
- Keep bundle size in mind for frontend packages
- Document why the dependency is needed

## Security

- Never commit `.env` files or secrets
- Report security vulnerabilities to maintainers privately
- Use parameterized queries (Prisma handles this)
- Validate all user input with Zod

## Questions?

- Open a [GitHub Discussion](https://github.com/mahmud-r-farhan/gameshop/discussions)
- Join our community chat
- Check existing issues and PRs

Thank you for contributing! 🎮
