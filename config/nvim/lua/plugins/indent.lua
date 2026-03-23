return {
  -- snacks.nvimのインデントガイドの色を薄く設定
  {
    "folke/snacks.nvim",
    opts = {
      indent = {
        enabled = true, -- インデントガイドを有効化
        char = "│",
        only_scope = false,
        only_current = false,
      },
    },
  },
}

