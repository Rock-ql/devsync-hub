package com.devsync.service.impl;

import cn.hutool.core.bean.BeanUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.devsync.common.enums.IterationStatusEnum;
import com.devsync.common.enums.SqlStatusEnum;
import com.devsync.dto.rsp.DashboardRsp;
import com.devsync.dto.rsp.IterationRsp;
import com.devsync.dto.rsp.ProjectRsp;
import com.devsync.entity.GitCommit;
import com.devsync.entity.Iteration;
import com.devsync.entity.PendingSql;
import com.devsync.entity.Project;
import com.devsync.mapper.GitCommitMapper;
import com.devsync.mapper.IterationMapper;
import com.devsync.mapper.PendingSqlMapper;
import com.devsync.mapper.ProjectMapper;
import com.devsync.service.IDashboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 仪表盘服务实现
 *
 * @author xiaolei
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements IDashboardService {

    private final ProjectMapper projectMapper;
    private final IterationMapper iterationMapper;
    private final PendingSqlMapper pendingSqlMapper;
    private final GitCommitMapper gitCommitMapper;

    @Override
    public DashboardRsp getOverview() {
        log.info("[仪表盘] 获取概览数据");

        DashboardRsp rsp = new DashboardRsp();

        // 项目统计
        LambdaQueryWrapper<Project> projectWrapper = new LambdaQueryWrapper<>();
        Long projectCount = projectMapper.selectCount(projectWrapper);
        rsp.setProjectCount(projectCount.intValue());

        projectWrapper.eq(Project::getState, 1);
        Long activeProjectCount = projectMapper.selectCount(projectWrapper);
        rsp.setActiveProjectCount(activeProjectCount.intValue());

        // 迭代统计
        LambdaQueryWrapper<Iteration> iterationWrapper = new LambdaQueryWrapper<>();
        Long iterationCount = iterationMapper.selectCount(iterationWrapper);
        rsp.setIterationCount(iterationCount.intValue());

        iterationWrapper.in(Iteration::getStatus,
                IterationStatusEnum.DEVELOPING.getCode(),
                IterationStatusEnum.TESTING.getCode());
        Long activeIterationCount = iterationMapper.selectCount(iterationWrapper);
        rsp.setActiveIterationCount(activeIterationCount.intValue());

        // 待执行SQL统计
        LambdaQueryWrapper<PendingSql> sqlWrapper = new LambdaQueryWrapper<>();
        sqlWrapper.eq(PendingSql::getStatus, SqlStatusEnum.PENDING.getCode());
        Long pendingSqlCount = pendingSqlMapper.selectCount(sqlWrapper);
        rsp.setPendingSqlCount(pendingSqlCount.intValue());

        // 提交统计
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime todayEnd = LocalDate.now().atTime(LocalTime.MAX);
        List<GitCommit> todayCommits = gitCommitMapper.selectAllByTimeRange(todayStart, todayEnd);
        rsp.setTodayCommitCount(todayCommits.size());

        LocalDate monday = LocalDate.now().with(DayOfWeek.MONDAY);
        LocalDateTime weekStart = monday.atStartOfDay();
        List<GitCommit> weekCommits = gitCommitMapper.selectAllByTimeRange(weekStart, todayEnd);
        rsp.setWeekCommitCount(weekCommits.size());

        // 最近项目列表（前5个）
        LambdaQueryWrapper<Project> recentProjectWrapper = new LambdaQueryWrapper<>();
        recentProjectWrapper.eq(Project::getState, 1)
                .orderByDesc(Project::getUpdatedAt)
                .last("LIMIT 5");
        List<Project> recentProjects = projectMapper.selectList(recentProjectWrapper);
        rsp.setRecentProjects(recentProjects.stream()
                .map(this::convertToProjectRsp)
                .collect(Collectors.toList()));

        // 最近迭代列表（前5个）
        LambdaQueryWrapper<Iteration> recentIterationWrapper = new LambdaQueryWrapper<>();
        recentIterationWrapper.orderByDesc(Iteration::getUpdatedAt)
                .last("LIMIT 5");
        List<Iteration> recentIterations = iterationMapper.selectList(recentIterationWrapper);
        rsp.setRecentIterations(recentIterations.stream()
                .map(this::convertToIterationRsp)
                .collect(Collectors.toList()));

        // 按项目分组的待执行SQL
        rsp.setPendingSqlByProject(getPendingSqlByProject());

        log.info("[仪表盘] 获取概览数据完成");
        return rsp;
    }

    /**
     * 获取按项目分组的待执行SQL
     */
    private List<DashboardRsp.ProjectPendingSqlRsp> getPendingSqlByProject() {
        LambdaQueryWrapper<PendingSql> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(PendingSql::getStatus, SqlStatusEnum.PENDING.getCode());
        List<PendingSql> pendingSqlList = pendingSqlMapper.selectList(wrapper);

        // 按项目分组
        Map<Integer, Long> countByProject = pendingSqlList.stream()
                .collect(Collectors.groupingBy(PendingSql::getProjectId, Collectors.counting()));

        // 获取项目名称
        Map<Integer, String> projectNames = new HashMap<>();
        if (!countByProject.isEmpty()) {
            List<Project> projects = projectMapper.selectBatchIds(countByProject.keySet());
            for (Project project : projects) {
                projectNames.put(project.getId(), project.getName());
            }
        }

        // 构建结果
        List<DashboardRsp.ProjectPendingSqlRsp> result = new ArrayList<>();
        for (Map.Entry<Integer, Long> entry : countByProject.entrySet()) {
            DashboardRsp.ProjectPendingSqlRsp item = new DashboardRsp.ProjectPendingSqlRsp();
            item.setProjectId(entry.getKey());
            item.setProjectName(projectNames.getOrDefault(entry.getKey(), "未知项目"));
            item.setCount(entry.getValue().intValue());
            result.add(item);
        }

        return result;
    }

    /**
     * 转换为项目响应对象
     */
    private ProjectRsp convertToProjectRsp(Project project) {
        ProjectRsp rsp = new ProjectRsp();
        BeanUtil.copyProperties(project, rsp);
        rsp.setIterationCount(iterationMapper.countByProjectId(project.getId()));
        rsp.setPendingSqlCount(pendingSqlMapper.countPendingByProjectId(project.getId()));
        return rsp;
    }

    /**
     * 转换为迭代响应对象
     */
    private IterationRsp convertToIterationRsp(Iteration iteration) {
        IterationRsp rsp = new IterationRsp();
        BeanUtil.copyProperties(iteration, rsp);

        Project project = projectMapper.selectById(iteration.getProjectId());
        if (project != null) {
            rsp.setProjectName(project.getName());
        }

        IterationStatusEnum statusEnum = IterationStatusEnum.getByCode(iteration.getStatus());
        if (statusEnum != null) {
            rsp.setStatusDesc(statusEnum.getDesc());
        }

        rsp.setPendingSqlCount(pendingSqlMapper.countPendingByIterationId(iteration.getId()));
        return rsp;
    }
}
