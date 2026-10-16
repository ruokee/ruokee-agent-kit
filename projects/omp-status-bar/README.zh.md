# omp-status-bar

[English](./README.md)

一个常驻的 OMP 状态栏：一个 `belowEditor` Widget Host 加内置 Provider，显示总 token、输入 token、缓存读取 token、输出 token、缓存命中率、上下文用量，以及本次会话已回答的模型请求次数。

第三方扩展通过 `@ruokee/omp-status-bar/provider` 的公开合同添加 Provider。

## 文档

- [使用与配置](./docs/usage.zh.md)
- [Provider 合同](./docs/provider-contract.zh.md)
- [Provider 开发指南](./docs/provider-dev.zh.md)

## 兼容性

最低维护 OMP 版本为 `18.5.0`，不设置维护版本上限。本小节声明维护责任，不作为安装或运行条件。更早的宿主仍可能运行本 Package，但不因此获得维护承诺。这一声明不保证后续版本继续可用，也不表示下限及以上的每个版本都已验证。

Package 将 `@oh-my-pi/pi-coding-agent`、`@oh-my-pi/pi-agent-core` 和 `@oh-my-pi/pi-tui` 声明为不限制版本的宿主 peer（`*`）。这些声明不定义维护范围，也不构成对每个宿主版本的兼容承诺。

自动化检查与真实 TUI 验证覆盖的版本及未覆盖之处见[使用与配置](./docs/usage.zh.md)。

## 安装

Package 尚未发布。安装命令、配置文件，以及配置修改何时生效见[使用与配置](./docs/usage.zh.md)。

### 更新

`omp plugin link` 注册的是这个检出目录，安装会一直从该目录加载 Package 及其依赖。请保留该目录，并在仓库根目录更新：

```bash
cd /path/to/ruokee-agent-kit
git pull
cd projects/omp-status-bar
bun install --frozen-lockfile
```

之后重启 OMP：运行中的进程会继续使用启动时加载的扩展代码，在同一进程中新建会话不会重新加载。

## 开发

```bash
bun install
bun run typecheck
bun test
```

运行时导入只限两个宿主包：`@oh-my-pi/pi-coding-agent` 与 `@oh-my-pi/pi-tui`。

## 许可证

本组件使用 [MIT 许可证](./LICENSE)。
