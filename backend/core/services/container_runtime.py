import os
import shutil
import subprocess
import json
import logging
from typing import Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)


class ContainerRuntimeAdapter:
    """
    Adapter for Podman and Docker container engines.
    Provides uniform execution for image builds, tagging, running, and Compose orchestration.
    """

    def __init__(self, preferred_runtime: str = "podman"):
        self.preferred_runtime = preferred_runtime.lower()
        self.runtime_binary = self._detect_runtime()
        logger.info(f"ContainerRuntimeAdapter initialized using: {self.runtime_binary}")

    def _detect_runtime(self) -> str:
        # Check preferred first
        if self.preferred_runtime == "podman" and shutil.which("podman"):
            return "podman"
        if self.preferred_runtime == "docker" and shutil.which("docker"):
            return "docker"
        # Fallbacks
        if shutil.which("podman"):
            return "podman"
        if shutil.which("docker"):
            return "docker"
        return "podman"

    def is_available(self) -> Tuple[bool, str]:
        try:
            res = subprocess.run(
                [self.runtime_binary, "version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=8
            )
            if res.returncode == 0:
                return True, f"{self.runtime_binary} available and responsive"
            return False, f"{self.runtime_binary} error: {res.stderr.strip()}"
        except Exception as e:
            return False, f"Cannot invoke {self.runtime_binary}: {str(e)}"

    def build_image(
        self,
        image_tag: str,
        dockerfile_path: str,
        context_dir: str,
        build_args: Optional[Dict[str, str]] = None,
        timeout: int = 300
    ) -> Tuple[bool, str, Dict[str, Any]]:
        cmd = [self.runtime_binary, "build", "-t", image_tag, "-f", dockerfile_path]
        if build_args:
            for k, v in build_args.items():
                cmd.extend(["--build-arg", f"{k}={v}"])
        cmd.append(context_dir)

        logger.info(f"Executing: {' '.join(cmd)}")
        try:
            res = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                timeout=timeout
            )
            success = (res.returncode == 0)
            metadata = {
                "runtime": self.runtime_binary,
                "exit_code": res.returncode,
                "image_tag": image_tag,
            }
            return success, res.stdout, metadata
        except subprocess.TimeoutExpired:
            return False, f"Image build timed out after {timeout} seconds", {"error": "timeout"}
        except Exception as e:
            return False, f"Exception during image build: {str(e)}", {"error": str(e)}

    def inspect_image(self, image_tag: str) -> Optional[Dict[str, Any]]:
        cmd = [self.runtime_binary, "image", "inspect", image_tag]
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10)
            if res.returncode == 0 and res.stdout.strip():
                data = json.loads(res.stdout)
                return data[0] if isinstance(data, list) and len(data) > 0 else None
        except Exception:
            pass
        return None

    def run_staging_container(
        self,
        image_tag: str,
        container_name: str = "deployforge-staging-app",
        port_mapping: str = "8085:8085",
        env_vars: Optional[Dict[str, str]] = None
    ) -> Tuple[bool, str]:
        # Stop existing container if present
        self.stop_and_remove(container_name)

        cmd = [
            self.runtime_binary, "run", "-d",
            "--name", container_name,
            "-p", port_mapping,
        ]
        if env_vars:
            for k, v in env_vars.items():
                cmd.extend(["-e", f"{k}={v}"])
        cmd.append(image_tag)

        logger.info(f"Running staging container: {' '.join(cmd)}")
        try:
            res = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                timeout=30
            )
            return (res.returncode == 0), res.stdout
        except Exception as e:
            return False, str(e)

    def stop_and_remove(self, container_name: str) -> Tuple[bool, str]:
        cmd_stop = [self.runtime_binary, "stop", "-t", "2", container_name]
        cmd_rm = [self.runtime_binary, "rm", "-f", container_name]
        subprocess.run(cmd_stop, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        res = subprocess.run(cmd_rm, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return (res.returncode == 0), res.stdout

    def compose_up(self, compose_file: str, env_vars: Optional[Dict[str, str]] = None) -> Tuple[bool, str]:
        env = os.environ.copy()
        if env_vars:
            env.update(env_vars)

        # Check podman compose vs docker compose
        if self.runtime_binary == "podman":
            compose_cmd = ["podman", "compose"]
        else:
            compose_cmd = ["docker", "compose"]

        cmd = compose_cmd + ["-f", compose_file, "up", "-d", "--force-recreate"]
        try:
            res = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                env=env,
                timeout=60
            )
            return (res.returncode == 0), res.stdout
        except Exception as e:
            # Fallback to direct container run if compose provider fails
            logger.warning(f"Compose failed ({e}), attempting direct container execution fallback")
            image = env.get("DEPLOYFORGE_IMAGE", "sample-app:latest")
            return self.run_staging_container(image_tag=image, env_vars=env_vars)

    def compose_down(self, compose_file: str) -> Tuple[bool, str]:
        if self.runtime_binary == "podman":
            compose_cmd = ["podman", "compose"]
        else:
            compose_cmd = ["docker", "compose"]

        cmd = compose_cmd + ["-f", compose_file, "down"]
        try:
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=30)
            return (res.returncode == 0), res.stdout
        except Exception as e:
            return False, str(e)


# Default singleton instance
runtime_adapter = ContainerRuntimeAdapter()
