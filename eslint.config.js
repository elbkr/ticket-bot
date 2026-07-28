import js from "@eslint/js";
import globals from "globals";

export default [
    {
        ignores: ["node_modules/", "dist/", "coverage/"],
    },
    js.configs.recommended,
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: globals.node,
        },
        rules: {
            "no-console": "off",
            "no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
            "no-undef": "error",
            "no-duplicate-imports": "error",
            eqeqeq: ["error", "always"],
            "prefer-const": "error",
            "no-var": "error",
            "object-shorthand": ["error", "always"],
            "prefer-template": "error",
            "arrow-body-style": ["error", "as-needed"],
        },
    },
];
