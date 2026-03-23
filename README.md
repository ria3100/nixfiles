# nixfiles

nix-darwin + home-manager による macOS 環境管理。

SSH鍵・シークレットは iCloud Keychain 経由で同期され、ビルド時に自動配置される。

## 新しいマシンのセットアップ

### 1. Nix のインストール

```sh
curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh
```

### 2. リポジトリのクローン

iCloud Keychain が同期済みであれば、SSH鍵はビルド時に自動配置される。
初回は HTTPS でクローンし、ビルド後に remote を SSH に切り替える。

```sh
git clone https://github.com/ria3100/nixfiles.git ~/nixfiles
```

### 3. ビルド・適用

```sh
cd ~/nixfiles
sudo nix run nix-darwin -- switch --flake .
```

初回実行後は `darwin-rebuild` が PATH に入るため、以降は以下で適用可能。

```sh
darwin-rebuild switch --flake ~/nixfiles
```

### 4. remote を SSH に切り替え

```sh
cd ~/nixfiles
git remote set-url origin git@github.com:ria3100/nixfiles.git
```

## Keychain で管理しているシークレット

以下はすべて iCloud Keychain 経由で同期され、`darwin-rebuild switch` 時に自動配置される。

| Keychain キー | 配置先 |
|---|---|
| `ssh-id_ed25519_github` | `~/.ssh/id_ed25519_github` |
| `ssh-id_ed25519_github-pub` | `~/.ssh/id_ed25519_github.pub` |
| `secret-NPM_TOKEN` | `~/.secrets` |
| `secret-CLAUDE_CODE_OAUTH_TOKEN` | `~/.secrets` |
| `secret-FIGMA_OAUTH_TOKEN` | `~/.secrets` |
| `npm-github-packages` | `~/.npmrc` |
| `npm-registry` | `~/.npmrc` |

### 新しいシークレットの追加

```sh
security add-generic-password -s "secret-<NAME>" -a "ria" -w "<value>"
```

`hosts/default.nix` の `.secrets` 生成ループに変数名を追加する。
