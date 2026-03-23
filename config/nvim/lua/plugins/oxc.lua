return {
  -- oxlint: linter (LSP)
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        oxlint = {},
      },
    },
  },
  -- oxfmt: formatter (LSP + conform)
  {
    "neovim/nvim-lspconfig",
    opts = {
      servers = {
        oxfmt = {},
      },
    },
  },
  {
    "stevearc/conform.nvim",
    opts = {
      formatters_by_ft = {
        javascript = { "oxfmt" },
        javascriptreact = { "oxfmt" },
        typescript = { "oxfmt" },
        typescriptreact = { "oxfmt" },
        json = { "oxfmt" },
        vue = { "oxfmt" },
      },
    },
  },
}
