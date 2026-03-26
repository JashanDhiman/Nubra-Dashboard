# Development Setup

## Code Formatting and Linting

This project uses Prettier and ESLint for code formatting and linting.

### Installation

First, install the dependencies:

```bash
npm install
```

### Available Scripts

- `npm run lint` - Run ESLint to check for code issues
- `npm run lint:fix` - Automatically fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check if code is properly formatted

### VS Code Setup (Recommended)

For the best development experience, install these VS Code extensions:

1. **ESLint** - `dbaeumer.vscode-eslint`
2. **Prettier - Code formatter** - `esbenp.prettier-vscode`

Then add these settings to your workspace or user settings:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.detectIndentation": false
}
```

### Pre-commit Hooks (Optional)

To ensure code quality before commits, you can set up husky and lint-staged:

```bash
npm install --save-dev husky lint-staged
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

Add to your `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,css,md}": ["prettier --write"]
  }
}
```

### Configuration Files

- `.prettierrc` - Prettier configuration
- `.eslintrc.json` - ESLint configuration
- `.prettierignore` - Files to ignore for Prettier
- `.eslintignore` - Files to ignore for ESLint
