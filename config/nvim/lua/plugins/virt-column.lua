return {
  {
    "lukas-reineke/virt-column.nvim",
    opts = {
      char = "│",
      virtcolumn = "80,100",
      highlight = "VirtColumn",
    },
    config = function(_, opts)
      vim.api.nvim_set_hl(0, "VirtColumn", { fg = "#3a3a3a" })
      require("virt-column").setup(opts)
    end,
  },
}
