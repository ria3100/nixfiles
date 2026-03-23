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
        custom_hlgroups = {
          -- 背景を透明にする
          Normal = { bg = "NONE" },
          NormalFloat = { bg = "NONE" },
          NormalNC = { bg = "NONE" },
          SignColumn = { bg = "NONE" },
          EndOfBuffer = { bg = "NONE" },
        },
      })

      -- カラースキーム読み込み後に背景を強制的に透明化
      vim.api.nvim_create_autocmd("ColorScheme", {
        pattern = "*",
        callback = function()
          local groups = {
            "Normal",
            "NormalFloat",
            "NormalNC",
            "SignColumn",
            "EndOfBuffer",
            "LineNr",
            "Folded",
            "NonText",
            "SpecialKey",
            "VertSplit",
            "StatusLine",
            "StatusLineNC",
            "MsgArea",
          }
          for _, group in ipairs(groups) do
            vim.api.nvim_set_hl(0, group, { bg = "NONE", ctermbg = "NONE" })
          end
        end,
      })
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
