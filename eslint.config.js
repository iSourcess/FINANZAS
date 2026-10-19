import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
    { ignores: ["dist", "android", "node_modules", ".claude"] },
    js.configs.recommended,
    {
        files: ["**/*.{js,jsx}"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: { ...globals.browser },
            parserOptions: { ecmaFeatures: { jsx: true } },
        },
        settings: { react: { version: "18.3" } },
        plugins: { react, "react-hooks": reactHooks, "react-refresh": reactRefresh },
        rules: {
            ...react.configs.recommended.rules,
            ...react.configs["jsx-runtime"].rules,
            ...reactHooks.configs.recommended.rules,
            "react/prop-types": "off",
            "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
            "no-unused-vars": ["warn", { varsIgnorePattern: "^[A-Z_]" }],
        },
    },
    {
        files: ["tests/**/*.js", "*.config.js"],
        languageOptions: { globals: { ...globals.node } },
    },
];