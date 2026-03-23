# nixfiles

nix-darwin + home-manager による macOS 環境管理。

## 新しいマシンのセットアップ

### 1. Nix のインストール

```sh
curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh
```

### 2. SSH 鍵の生成

```sh
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github
```

生成した公開鍵を GitHub に登録する。

### 3. リポジトリのクローン

```sh
git clone git@github.com:ria3100/nixfiles.git ~/nixfiles
```

### 4. ビルド・適用

```sh
cd ~/nixfiles
sudo nix run nix-darwin -- switch --flake .
```

初回実行後は `darwin-rebuild` がPATHに入るため、以降は以下で適用可能。

```sh
darwin-rebuild switch --flake ~/nixfiles
```

### 5. 手動対応

- **App Store にログイン** — mas による Amphetamine のインストールに必要
- **シークレットの配置** — `~/.secrets` を作成し、環境変数を記述
- **npm トークンの登録** — Keychain に登録すると `.npmrc` が自動生成される
  ```sh
  security add-generic-password -s "npm-github-packages" -a "ria" -w "<token>"
  security add-generic-password -s "npm-registry" -a "ria" -w "<token>"
  ```
- **Vite+ のインストール**
  ```sh
  curl -fsSL https://vite.plus | bash
  ```
