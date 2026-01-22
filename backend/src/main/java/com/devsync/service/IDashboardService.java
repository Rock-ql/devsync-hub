package com.devsync.service;

import com.devsync.dto.rsp.DashboardRsp;

/**
 * 仪表盘服务接口
 *
 * @author xiaolei
 */
public interface IDashboardService {

    /**
     * 获取仪表盘概览数据
     *
     * @return 概览数据
     */
    DashboardRsp getOverview();
}
