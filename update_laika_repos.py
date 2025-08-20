#!/usr/bin/env python3
"""
LAIKA Repository Update Script
Standalone script to update LAIKA repositories recursively
"""

import subprocess
import os
import sys
import argparse
from datetime import datetime
from pathlib import Path

class LAIKARepoUpdater:
    def __init__(self, base_path="/home/pi/LAIKA"):
        self.base_path = Path(base_path)
        self.verbose = False
        
    def log(self, message, level="INFO"):
        """Log message with timestamp"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        prefix = f"[{timestamp}] [{level}]"
        print(f"{prefix} {message}")
        
    def run_command(self, cmd, cwd=None, timeout=60):
        """Run a command and return result"""
        try:
            if self.verbose:
                self.log(f"Running: {' '.join(cmd)} in {cwd or 'current dir'}")
                
            result = subprocess.run(
                cmd,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False
            )
            
            if self.verbose and result.stdout:
                self.log(f"STDOUT: {result.stdout.strip()}")
            if self.verbose and result.stderr:
                self.log(f"STDERR: {result.stderr.strip()}")
                
            return result
            
        except subprocess.TimeoutExpired:
            self.log(f"Command timed out after {timeout}s: {' '.join(cmd)}", "ERROR")
            return None
        except Exception as e:
            self.log(f"Command failed: {' '.join(cmd)} - {str(e)}", "ERROR")
            return None
    
    def check_git_repo(self, repo_path):
        """Check if path is a valid git repository"""
        git_dir = repo_path / ".git"
        return git_dir.exists()
    
    def get_current_branch(self, repo_path):
        """Get current branch name"""
        result = self.run_command(['git', 'branch', '--show-current'], cwd=repo_path)
        if result and result.returncode == 0:
            return result.stdout.strip()
        return 'main'  # fallback
    
    def get_repo_status(self, repo_path, repo_name):
        """Get detailed repository status"""
        if not self.check_git_repo(repo_path):
            return {
                'name': repo_name,
                'path': str(repo_path),
                'status': 'not_a_git_repo',
                'branch': 'unknown',
                'commits_behind': 0,
                'has_changes': False
            }
        
        # Get current branch
        current_branch = self.get_current_branch(repo_path)
        
        # Check for uncommitted changes
        status_result = self.run_command(['git', 'status', '--porcelain'], cwd=repo_path)
        has_changes = bool(status_result and status_result.stdout.strip())
        
        # Fetch to get latest remote info
        self.run_command(['git', 'fetch', 'origin'], cwd=repo_path, timeout=30)
        
        # Check commits behind
        behind_result = self.run_command(
            ['git', 'rev-list', '--count', f'HEAD..origin/{current_branch}'],
            cwd=repo_path
        )
        commits_behind = 0
        if behind_result and behind_result.returncode == 0:
            try:
                commits_behind = int(behind_result.stdout.strip())
            except ValueError:
                commits_behind = 0
        
        # Determine status
        if has_changes:
            status = 'has_local_changes'
        elif commits_behind > 0:
            status = 'needs_update'
        else:
            status = 'up_to_date'
        
        return {
            'name': repo_name,
            'path': str(repo_path),
            'status': status,
            'branch': current_branch,
            'commits_behind': commits_behind,
            'has_changes': has_changes
        }
    
    def update_repository(self, repo_path, repo_name, force=False):
        """Update a single repository"""
        self.log(f"Updating {repo_name}...")
        
        if not self.check_git_repo(repo_path):
            self.log(f"{repo_name} is not a git repository", "ERROR")
            return False
        
        # Get status first
        status = self.get_repo_status(repo_path, repo_name)
        
        if status['has_changes'] and not force:
            self.log(f"{repo_name} has local changes. Use --force to override", "WARNING")
            return False
        
        # Get current branch
        current_branch = status['branch']
        
        # Stash changes if forcing and there are changes
        if force and status['has_changes']:
            self.log(f"Stashing local changes in {repo_name}")
            stash_result = self.run_command(['git', 'stash'], cwd=repo_path)
            if stash_result and stash_result.returncode != 0:
                self.log(f"Failed to stash changes in {repo_name}", "ERROR")
                return False
        
        # Fetch latest changes
        self.log(f"Fetching latest changes for {repo_name}")
        fetch_result = self.run_command(['git', 'fetch', 'origin'], cwd=repo_path, timeout=60)
        if not fetch_result or fetch_result.returncode != 0:
            self.log(f"Failed to fetch {repo_name}", "ERROR")
            return False
        
        # Pull changes
        self.log(f"Pulling changes for {repo_name}")
        pull_result = self.run_command(['git', 'pull', 'origin', current_branch], cwd=repo_path, timeout=60)
        if not pull_result or pull_result.returncode != 0:
            self.log(f"Failed to pull {repo_name}: {pull_result.stderr if pull_result else 'timeout'}", "ERROR")
            return False
        
        self.log(f"Successfully updated {repo_name}", "SUCCESS")
        return True
    
    def update_submodules(self, repo_path, force=False):
        """Update git submodules"""
        self.log("Updating submodules...")
        
        if not self.check_git_repo(repo_path):
            self.log("Main repository is not a git repository", "ERROR")
            return False
        
        # Check if there are any submodules
        gitmodules_path = repo_path / ".gitmodules"
        if not gitmodules_path.exists():
            self.log("No submodules found")
            return True
        
        commands = [
            ['git', 'submodule', 'update', '--init', '--recursive'],
            ['git', 'submodule', 'foreach', '--recursive', 'git', 'fetch', 'origin'],
            ['git', 'submodule', 'foreach', '--recursive', 'git', 'pull', 'origin', 'main']
        ]
        
        if force:
            # Add force commands
            commands.insert(0, ['git', 'submodule', 'foreach', '--recursive', 'git', 'reset', '--hard', 'HEAD'])
            commands.append(['git', 'submodule', 'foreach', '--recursive', 'git', 'clean', '-fd'])
        
        for cmd in commands:
            self.log(f"Running submodule command: {' '.join(cmd)}")
            result = self.run_command(cmd, cwd=repo_path, timeout=120)
            if not result or result.returncode != 0:
                self.log(f"Submodule command failed: {' '.join(cmd)}", "ERROR")
                if result:
                    self.log(f"Error: {result.stderr}", "ERROR")
                return False
        
        self.log("Successfully updated submodules", "SUCCESS")
        return True
    
    def check_status(self):
        """Check status of all repositories"""
        self.log("Checking repository status...")
        
        repositories = []
        
        # Main repository
        if self.base_path.exists():
            main_status = self.get_repo_status(self.base_path, "LAIKA (Main)")
            repositories.append(main_status)
            
            # Check for common submodules
            potential_submodules = [
                ("laika-pwa", self.base_path / "laika-pwa"),
                ("firmware", self.base_path / "firmware"),
                ("docs", self.base_path / "docs")
            ]
            
            for submodule_name, submodule_path in potential_submodules:
                if submodule_path.exists() and self.check_git_repo(submodule_path):
                    submodule_status = self.get_repo_status(submodule_path, submodule_name)
                    repositories.append(submodule_status)
        
        # Print status report
        self.log("Repository Status Report:")
        self.log("-" * 60)
        
        for repo in repositories:
            status_icon = {
                'up_to_date': '✅',
                'needs_update': '⚠️ ',
                'has_local_changes': '🔄',
                'not_a_git_repo': '❌',
                'error': '❌'
            }.get(repo['status'], '❓')
            
            self.log(f"{status_icon} {repo['name']}")
            self.log(f"    Path: {repo['path']}")
            self.log(f"    Branch: {repo['branch']}")
            self.log(f"    Status: {repo['status']}")
            if repo['commits_behind'] > 0:
                self.log(f"    Behind by: {repo['commits_behind']} commits")
            self.log("")
        
        return repositories
    
    def update_all(self, force=False, submodules=True):
        """Update all repositories"""
        self.log("Starting full repository update...")
        
        success = True
        
        # Update main repository
        if self.base_path.exists():
            main_success = self.update_repository(self.base_path, "LAIKA (Main)", force)
            success = success and main_success
            
            # Update submodules if requested and main update was successful
            if submodules and main_success:
                submodule_success = self.update_submodules(self.base_path, force)
                success = success and submodule_success
        else:
            self.log(f"LAIKA repository not found at {self.base_path}", "ERROR")
            success = False
        
        if success:
            self.log("All repositories updated successfully!", "SUCCESS")
        else:
            self.log("Some updates failed. Check the log above.", "ERROR")
        
        return success

def main():
    parser = argparse.ArgumentParser(description="LAIKA Repository Update Tool")
    parser.add_argument('--base-path', default='/home/pi/LAIKA', 
                       help='Base path to LAIKA repository')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose output')
    parser.add_argument('--force', '-f', action='store_true',
                       help='Force update even with local changes')
    parser.add_argument('--no-submodules', action='store_true',
                       help='Skip submodule updates')
    
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Status command
    subparsers.add_parser('status', help='Check repository status')
    
    # Update command
    update_parser = subparsers.add_parser('update', help='Update repositories')
    update_parser.add_argument('--main-only', action='store_true',
                              help='Update only main repository')
    
    # Submodules command
    subparsers.add_parser('submodules', help='Update only submodules')
    
    args = parser.parse_args()
    
    # Create updater
    updater = LAIKARepoUpdater(args.base_path)
    updater.verbose = args.verbose
    
    # Execute command
    if args.command == 'status':
        updater.check_status()
    elif args.command == 'update':
        if args.main_only:
            updater.update_repository(updater.base_path, "LAIKA (Main)", args.force)
        else:
            updater.update_all(args.force, not args.no_submodules)
    elif args.command == 'submodules':
        updater.update_submodules(updater.base_path, args.force)
    else:
        # Default: check status then update
        updater.check_status()
        print("\nTo update repositories, run:")
        print(f"  {sys.argv[0]} update")
        print(f"  {sys.argv[0]} update --force  (to override local changes)")
        print(f"  {sys.argv[0]} update --main-only  (main repo only)")

if __name__ == '__main__':
    main()
