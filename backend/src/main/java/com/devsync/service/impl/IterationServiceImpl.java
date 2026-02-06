package com.devsync.service.impl;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.util.StrUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.devsync.common.enums.IterationStatusEnum;
import com.devsync.common.exception.BusinessException;
import com.devsync.common.result.PageResult;
import com.devsync.dto.req.IterationAddReq;
import com.devsync.dto.req.IterationListReq;
import com.devsync.dto.req.IterationUpdateReq;
import com.devsync.dto.rsp.IterationRsp;
import com.devsync.entity.Iteration;
import com.devsync.entity.Project;
import com.devsync.mapper.IterationMapper;
import com.devsync.mapper.PendingSqlMapper;
import com.devsync.mapper.ProjectMapper;
import com.devsync.mapper.RequirementMapper;
import com.devsync.service.IIterationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 迭代服务实现
 *
 * @author xiaolei
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class IterationServiceImpl extends ServiceImpl<IterationMapper, Iteration> implements IIterationService {

    private final IterationMapper iterationMapper;
    private final ProjectMapper projectMapper;
    private final PendingSqlMapper pendingSqlMapper;
    private final RequirementMapper requirementMapper;

    @Override
    public PageResult<IterationRsp> listIterations(IterationListReq req) {
        log.info("[迭代管理] 分页查询迭代列表，参数: projectId={}, name={}, status={}",
                req.getProjectId(), req.getName(), req.getStatus());

        LambdaQueryWrapper<Iteration> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(req.getProjectId() != null, Iteration::getProjectId, req.getProjectId())
                .like(StrUtil.isNotBlank(req.getName()), Iteration::getName, req.getName())
                .eq(StrUtil.isNotBlank(req.getStatus()), Iteration::getStatus, req.getStatus())
                .orderByDesc(Iteration::getCreatedAt);

        Page<Iteration> page = new Page<>(req.getPageNum(), req.getPageSize());
        Page<Iteration> result = iterationMapper.selectPage(page, wrapper);

        List<IterationRsp> list = result.getRecords().stream()
                .map(this::convertToRsp)
                .collect(Collectors.toList());

        return PageResult.of(list, result.getTotal(), result.getCurrent(), result.getSize());
    }

    @Override
    public List<IterationRsp> listByProject(Integer projectId) {
        log.info("[迭代管理] 获取项目的所有迭代，项目ID: {}", projectId);

        LambdaQueryWrapper<Iteration> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Iteration::getProjectId, projectId)
                .orderByDesc(Iteration::getCreatedAt);

        List<Iteration> iterations = iterationMapper.selectList(wrapper);
        return iterations.stream()
                .map(this::convertToRsp)
                .collect(Collectors.toList());
    }

    @Override
    public IterationRsp getIterationDetail(Integer id) {
        log.info("[迭代管理] 获取迭代详情，ID: {}", id);

        Iteration iteration = iterationMapper.selectById(id);
        if (iteration == null) {
            throw new BusinessException(404, "迭代不存在");
        }

        return convertToRsp(iteration);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Integer addIteration(IterationAddReq req) {
        log.info("[迭代管理] 新增迭代，项目ID: {}, 名称: {}", req.getProjectId(), req.getName());

        // 验证项目是否存在（项目ID可选）
        if (req.getProjectId() != null) {
            Project project = projectMapper.selectById(req.getProjectId());
            if (project == null) {
                throw new BusinessException(404, "指定的项目不存在");
            }
        }

        Iteration iteration = new Iteration();
        BeanUtil.copyProperties(req, iteration);

        // 默认状态为规划中
        if (StrUtil.isBlank(iteration.getStatus())) {
            iteration.setStatus(IterationStatusEnum.PLANNING.getCode());
        }

        iterationMapper.insert(iteration);
        log.info("[迭代管理] 新增迭代成功，ID: {}", iteration.getId());

        return iteration.getId();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateIteration(IterationUpdateReq req) {
        log.info("[迭代管理] 更新迭代，ID: {}", req.getId());

        Iteration iteration = iterationMapper.selectById(req.getId());
        if (iteration == null) {
            throw new BusinessException(404, "迭代不存在");
        }

        // 更新非空字段
        if (StrUtil.isNotBlank(req.getName())) {
            iteration.setName(req.getName());
        }
        if (req.getDescription() != null) {
            iteration.setDescription(req.getDescription());
        }
        if (StrUtil.isNotBlank(req.getStatus())) {
            // 验证状态值
            if (IterationStatusEnum.getByCode(req.getStatus()) == null) {
                throw new BusinessException(400, "无效的状态值");
            }
            iteration.setStatus(req.getStatus());
        }
        if (req.getStartDate() != null) {
            iteration.setStartDate(req.getStartDate());
        }
        if (req.getEndDate() != null) {
            iteration.setEndDate(req.getEndDate());
        }

        iterationMapper.updateById(iteration);
        log.info("[迭代管理] 更新迭代成功，ID: {}", req.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteIteration(Integer id) {
        log.info("[迭代管理] 删除迭代，ID: {}", id);

        Iteration iteration = iterationMapper.selectById(id);
        if (iteration == null) {
            throw new BusinessException(404, "迭代不存在");
        }

        iterationMapper.deleteById(id);
        log.info("[迭代管理] 删除迭代成功，ID: {}", id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateStatus(Integer id, String status) {
        log.info("[迭代管理] 更新迭代状态，ID: {}, 新状态: {}", id, status);

        Iteration iteration = iterationMapper.selectById(id);
        if (iteration == null) {
            throw new BusinessException(404, "迭代不存在");
        }

        // 验证状态值
        if (IterationStatusEnum.getByCode(status) == null) {
            throw new BusinessException(400, "无效的状态值");
        }

        iteration.setStatus(status);
        iterationMapper.updateById(iteration);
        log.info("[迭代管理] 更新迭代状态成功，ID: {}, 新状态: {}", id, status);
    }

    /**
     * 转换为响应对象
     */
    private IterationRsp convertToRsp(Iteration iteration) {
        IterationRsp rsp = new IterationRsp();
        BeanUtil.copyProperties(iteration, rsp);

        // 获取项目名称（项目ID可选）
        if (iteration.getProjectId() != null) {
            Project project = projectMapper.selectById(iteration.getProjectId());
            if (project != null) {
                rsp.setProjectName(project.getName());
            }
        }

        // 获取状态描述
        IterationStatusEnum statusEnum = IterationStatusEnum.getByCode(iteration.getStatus());
        if (statusEnum != null) {
            rsp.setStatusDesc(statusEnum.getDesc());
        }

        // 查询待执行SQL数量
        rsp.setPendingSqlCount(pendingSqlMapper.countPendingByIterationId(iteration.getId()));
        rsp.setRequirementCount(requirementMapper.countByIterationId(iteration.getId()));

        return rsp;
    }
}
