#!/bin/bash
# 将设备端程序安装为 systemd 服务（在树莓派/Linux 设备上运行）
set -e

INSTALL_DIR=$(cd "$(dirname "$0")/.." && pwd)
SERVICE_FILE="$INSTALL_DIR/scripts/ht-rmt-device.service"
TARGET="/etc/systemd/system/ht-rmt-device.service"

echo "安装目录: $INSTALL_DIR"

# 更新 service 文件中的路径
sed "s|/home/pi/ht-rmt-device|$INSTALL_DIR|g; s|User=pi|User=$(whoami)|g" \
  "$SERVICE_FILE" | sudo tee "$TARGET" > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable ht-rmt-device
sudo systemctl start  ht-rmt-device

echo "✓ 服务已安装并启动"
echo "  查看日志: sudo journalctl -u ht-rmt-device -f"
echo "  查看状态: sudo systemctl status ht-rmt-device"
