# UIGEN

> AI-powered UI component generator

UIGEN is a tool for generating user interface components with AI assistance. It streamlines the UI development workflow by leveraging AI to produce consistent, production-ready UI components from natural language descriptions or design specifications.

## Features

- **AI-Assisted Generation** — Describe what you need, and UIGEN produces UI components ready for integration
- **Automated Code Review** — Every pull request is automatically reviewed by Claude for quality, correctness, and best practices
- **Issue & PR Assistance** — Mention `@claude` in any issue or pull request comment to get AI-powered help directly in your workflow

## Getting Started

### Prerequisites

- Node.js (recommended: LTS version)
- Git

### Installation

```bash
git clone https://github.com/Bayan-Al-Durgham/uigen.git
cd uigen
npm install
```

### Usage

```bash
npm start
```

## AI-Powered GitHub Workflows

This project uses [Claude Code Action](https://github.com/anthropics/claude-code-action) for two automated AI workflows:

### `@claude` Assistant

Mention `@claude` in any issue or pull request to trigger AI assistance:

```
@claude Can you help me implement a dark mode toggle component?
```

Claude will analyze the request, explore the codebase, and either answer questions or implement changes directly.

### Automated Code Review

Every pull request automatically receives an AI-powered code review that checks for:

- Bugs and logic errors
- Security vulnerabilities
- Performance issues
- Code style and best practices

## Project Structure

```
uigen/
├── .github/
│   └── workflows/
│       ├── claude.yml              # @claude assistant workflow
│       └── claude-code-review.yml  # Automated PR review workflow
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

Pull requests are automatically reviewed by Claude. You can also mention `@claude` in your PR for additional help.

## License

This project is open source. See [LICENSE](LICENSE) for details.
