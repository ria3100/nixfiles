return {
  -- Monokaiテーマを追加
  {
    "tanvirtin/monokai.nvim",
    lazy = false,
    priority = 1000,
    config = function()
      require("monokai").setup({
        palette = require("monokai").classic,
        italic_comments = true,
      })
      -- 背景の透明化は config/options.lua の autocmd で行う
    end,
  },

  -- LazyVimのカラースキーム設定を上書き
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "monokai",
    },
  },
}
