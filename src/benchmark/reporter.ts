import * as fs from "fs";
import * as path from "path";
import * as chalk from "chalk";
import * as Table from "cli-table3";
import { BenchmarkResult } from "../types";

export interface BenchmarkReport {
  timestamp: Date;
  totalDuration: number;
  results: BenchmarkResult[];
  summary: {
    [ormName: string]: {
      totalOperations: number;
      averageDuration: number;
      totalMemoryUsed: number;
      fastestOperation: BenchmarkResult;
      slowestOperation: BenchmarkResult;
    };
  };
}

/**
 * 벤치마크 결과 리포터
 */
export class BenchmarkReporter {
  private results: BenchmarkResult[] = [];
  private startTime: Date = new Date();
  private defaultDir: string = "results";

  /**
   * 기본 디렉토리를 입력받은 path에 추가한다.
   * - 기본 디렉토리가 경로에 없다면 추가한다.
   * @param filePath
   * @returns
   */
  addDefaultDir(filePath: string): string {
    return filePath.startsWith(this.defaultDir)
      ? filePath
      : path.join(this.defaultDir, filePath);
  }

  /**
   * 경로에 폴더 생성
   * @param filePath
   * @returns
   */
  mkdirForFileDir(filePath: string): string {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return filePath;
  }

  /**
   * 벤치마크 결과 추가
   */
  addResults(results: BenchmarkResult[]): void {
    this.results.push(...results);
  }

  /**
   * 콘솔에 결과 출력
   */
  printConsoleReport(): void {
    console.log(chalk.blue("\n📊 ORM Performance Benchmark Results"));
    console.log(chalk.gray("=".repeat(80)));

    // ORM별 그룹핑
    const groupedResults = this.groupResultsByORM();

    Object.entries(groupedResults).forEach(([ormName, results]) => {
      console.log(chalk.yellow(`\n🔧 ${ormName} Results:`));

      // 개별 테스트 결과 테이블
      const table = new Table({
        head: [
          "Operation",
          "Duration (ms)",
          "Records",
          "Avg/Record (ms)",
          "Memory (MB)",
        ],
        colWidths: [35, 15, 12, 18, 15],
      });

      results.forEach((result) => {
        table.push([
          result.operation,
          result.duration.toFixed(2),
          result.totalRecords.toLocaleString(),
          result.averageTime.toFixed(4),
          result.memoryUsage
            ? (result.memoryUsage.used / 1024 / 1024).toFixed(2)
            : "N/A",
        ]);
      });

      console.log(table.toString());
    });

    // 전체 비교 테이블
    this.printComparisonTable();
  }

  /**
   * ORM 비교 테이블 출력
   */
  private printComparisonTable(): void {
    console.log(chalk.blue("\n🏆 ORM Performance Comparison"));

    const summary = this.generateSummary();
    const comparisonTable = new Table({
      head: [
        "ORM",
        "Operations",
        "Avg Duration (ms)",
        "Memory (MB)",
        "Fastest Op",
        "Slowest Op",
      ],
      colWidths: [12, 12, 18, 15, 25, 25],
    });

    Object.entries(summary).forEach(([ormName, stats]) => {
      comparisonTable.push([
        ormName,
        stats.totalOperations.toString(),
        stats.averageDuration.toFixed(2),
        (stats.totalMemoryUsed / 1024 / 1024).toFixed(2),
        `${stats.fastestOperation.operation} (${stats.fastestOperation.duration.toFixed(2)}ms)`,
        `${stats.slowestOperation.operation} (${stats.slowestOperation.duration.toFixed(2)}ms)`,
      ]);
    });

    console.log(comparisonTable.toString());
  }

  /**
   * JSON 파일로 결과 저장
   */
  saveToJSON(filePath: string): void {
    const report: BenchmarkReport = {
      timestamp: this.startTime,
      totalDuration: Date.now() - this.startTime.getTime(),
      results: this.results,
      summary: this.generateSummary(),
    };

    filePath = this.addDefaultDir(filePath);
    this.mkdirForFileDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(chalk.green(`✅ Results saved to: ${filePath}`));
  }

  /**
   * CSV 파일로 결과 저장
   */
  saveToCSV(filePath: string): void {
    const headers = [
      "ORM",
      "Operation",
      "Duration (ms)",
      "Total Records",
      "Average Time (ms)",
      "Memory Used (MB)",
      "Timestamp",
    ];

    const rows = this.results.map((result) => [
      result.orm,
      result.operation,
      result.duration.toFixed(2),
      result.totalRecords.toString(),
      result.averageTime.toFixed(4),
      result.memoryUsage
        ? (result.memoryUsage.used / 1024 / 1024).toFixed(2)
        : "N/A",
      result.timestamp.toISOString(),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    filePath = this.addDefaultDir(filePath);
    this.mkdirForFileDir(filePath);
    fs.writeFileSync(filePath, csvContent);
    console.log(chalk.green(`✅ Results saved to: ${filePath}`));
  }

  /**
   * 마크다운 리포트 생성
   */
  saveToMarkdown(filePath: string): void {
    const report = this.generateSummary();
    let markdown = `# ORM Performance Benchmark Report

**Generated:** ${new Date().toLocaleString()}  
**Total Operations:** ${this.results.length}  
**Total Duration:** ${((Date.now() - this.startTime.getTime()) / 1000).toFixed(2)}s

## Summary

| ORM | Operations | Avg Duration (ms) | Memory (MB) | Best Performance | Worst Performance |
|-----|------------|-------------------|-------------|------------------|-------------------|
`;

    Object.entries(report).forEach(([ormName, stats]) => {
      markdown += `| ${ormName} | ${stats.totalOperations} | ${stats.averageDuration.toFixed(2)} | ${(stats.totalMemoryUsed / 1024 / 1024).toFixed(2)} | ${stats.fastestOperation.operation} (${stats.fastestOperation.duration.toFixed(2)}ms) | ${stats.slowestOperation.operation} (${stats.slowestOperation.duration.toFixed(2)}ms) |\n`;
    });

    markdown += `\n## Detailed Results\n\n`;

    const groupedResults = this.groupResultsByORM();
    Object.entries(groupedResults).forEach(([ormName, results]) => {
      markdown += `### ${ormName}\n\n`;
      markdown += `| Operation | Duration (ms) | Records | Avg/Record (ms) | Memory (MB) |\n`;
      markdown += `|-----------|---------------|---------|-----------------|-------------|\n`;

      results.forEach((result) => {
        markdown += `| ${result.operation} | ${result.duration.toFixed(2)} | ${result.totalRecords.toLocaleString()} | ${result.averageTime.toFixed(4)} | ${result.memoryUsage ? (result.memoryUsage.used / 1024 / 1024).toFixed(2) : "N/A"} |\n`;
      });

      markdown += `\n`;
    });

    filePath = this.addDefaultDir(filePath);
    this.mkdirForFileDir(filePath);
    fs.writeFileSync(filePath, markdown);
    console.log(chalk.green(`✅ Results saved to: ${filePath}`));
  }

  /**
   * 결과를 ORM별로 그룹핑
   */
  private groupResultsByORM(): { [ormName: string]: BenchmarkResult[] } {
    return this.results.reduce(
      (groups, result) => {
        if (!groups[result.orm]) {
          groups[result.orm] = [];
        }
        groups[result.orm].push(result);
        return groups;
      },
      {} as { [ormName: string]: BenchmarkResult[] }
    );
  }

  /**
   * 요약 통계 생성
   */
  private generateSummary(): BenchmarkReport["summary"] {
    const grouped = this.groupResultsByORM();
    const summary: BenchmarkReport["summary"] = {};

    Object.entries(grouped).forEach(([ormName, results]) => {
      const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
      const totalMemory = results.reduce(
        (sum, r) => sum + (r.memoryUsage?.used || 0),
        0
      );
      const sortedByDuration = [...results].sort(
        (a, b) => a.duration - b.duration
      );

      summary[ormName] = {
        totalOperations: results.length,
        averageDuration: totalDuration / results.length,
        totalMemoryUsed: totalMemory,
        fastestOperation: sortedByDuration[0],
        slowestOperation: sortedByDuration[sortedByDuration.length - 1],
      };
    });

    return summary;
  }

  /**
   * 순위 분석
   */
  getRankings(): {
    [operationType: string]: { orm: string; duration: number; rank: number }[];
  } {
    const operationTypes = [...new Set(this.results.map((r) => r.operation))];
    const rankings: {
      [operationType: string]: {
        orm: string;
        duration: number;
        rank: number;
      }[];
    } = {};

    operationTypes.forEach((opType) => {
      const operationResults = this.results
        .filter((r) => r.operation === opType)
        .map((r) => ({ orm: r.orm, duration: r.duration }))
        .sort((a, b) => a.duration - b.duration);

      rankings[opType] = operationResults.map((result, index) => ({
        ...result,
        rank: index + 1,
      }));
    });

    return rankings;
  }
}
