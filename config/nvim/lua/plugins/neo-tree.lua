return {
  {
    "nvim-neo-tree/neo-tree.nvim",
    opts = function(_, opts)
      opts.filesystem = opts.filesystem or {}
      opts.filesystem.filtered_items = {
        visible = true,
        show_hidden_count = false,
        hide_dotfiles = false,
        hide_gitignored = false,
        hide_by_name = {},
        never_show = {},
      }
      opts.filesystem.follow_current_file = {
        enabled = true,
        leave_dirs_open = true,
      }
      opts.window = opts.window or {}
      opts.window.mappings = opts.window.mappings or {}
      opts.window.mappings["<bs>"] = "none"
      opts.window.mappings["<esc>"] = "none"
      return opts
    end,
    init = function()
      vim.api.nvim_set_hl(0, "NeoTreeGitIgnored", { fg = "#686859" })
      vim.api.nvim_set_hl(0, "NeoTreeDimText", { fg = "#686859" })
      vim.api.nvim_set_hl(0, "NeoTreeIndentMarker", { fg = "#3a3a3a" })
      vim.api.nvim_set_hl(0, "NeoTreeExpander", { fg = "#3a3a3a" })
    end,
  },
}
